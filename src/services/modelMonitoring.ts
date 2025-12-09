import { supabaseAdmin, Prediction, Match } from '@/lib/supabase'

interface ModelMetrics {
  overallAccuracy: number
  totalPredictions: number
  correctPredictions: number
  homeWinAccuracy: number
  awayWinAccuracy: number
  drawAccuracy: number
  confidenceCalibration: number
  driftPercentage: number
  lastUpdated: string
}

interface DriftAlert {
  id: string
  alertType: 'accuracy_drift' | 'confidence_misalignment' | 'prediction_bias'
  severity: 'low' | 'medium' | 'high'
  message: string
  currentAccuracy: number
  baselineAccuracy: number
  detectedAt: string
  resolved: boolean
}

export class ModelMonitoringService {
  private readonly DRIFT_THRESHOLD = 0.10 // 10% accuracy drop triggers alert
  private readonly BASELINE_ACCURACY = 0.55 // Expected baseline accuracy
  private readonly MIN_PREDICTIONS_FOR_DRIFT = 50 // Minimum predictions before monitoring drift

  /**
   * Calculate model accuracy and performance metrics
   */
  async calculateModelMetrics(daysBack: number = 30): Promise<ModelMetrics | null> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysBack)

      // Get completed matches with predictions
      const { data: predictions, error } = await supabaseAdmin
        .from('predictions')
        .select(`
          *,
          match:matches!predictions_match_id_fkey(
            home_score,
            away_score,
            status,
            match_date
          )
        `)
        .eq('match.status', 'completed')
        .gte('match.match_date', cutoffDate.toISOString())
        .order('created_at', { ascending: false })

      if (error || !predictions) {
        console.error('Error fetching predictions for metrics:', error)
        return null
      }

      const metrics = this.calculateAccuracyMetrics(predictions)

      // Check for model drift
      const driftPercentage = this.calculateDriftPercentage(metrics.overallAccuracy)

      return {
        ...metrics,
        driftPercentage,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error calculating model metrics:', error)
      return null
    }
  }

  /**
   * Check for model drift and create alerts if necessary
   */
  async checkModelDrift(): Promise<DriftAlert[]> {
    try {
      const alerts: DriftAlert[] = []

      // Get current metrics
      const currentMetrics = await this.calculateModelMetrics()
      if (!currentMetrics || currentMetrics.totalPredictions < this.MIN_PREDICTIONS_FOR_DRIFT) {
        return []
      }

      // Check accuracy drift
      if (currentMetrics.driftPercentage > this.DRIFT_THRESHOLD) {
        alerts.push({
          id: `accuracy_drift_${Date.now()}`,
          alertType: 'accuracy_drift',
          severity: currentMetrics.driftPercentage > 0.20 ? 'high' : 'medium',
          message: `Model accuracy has dropped by ${(currentMetrics.driftPercentage * 100).toFixed(1)}% from baseline`,
          currentAccuracy: currentMetrics.overallAccuracy,
          baselineAccuracy: this.BASELINE_ACCURACY,
          detectedAt: new Date().toISOString(),
          resolved: false
        })
      }

      // Check confidence calibration
      if (currentMetrics.confidenceCalibration < 0.7) {
        alerts.push({
          id: `confidence_misalignment_${Date.now()}`,
          alertType: 'confidence_misalignment',
          severity: 'medium',
          message: 'Model confidence scores are poorly calibrated with actual accuracy',
          currentAccuracy: currentMetrics.overallAccuracy,
          baselineAccuracy: this.BASELINE_ACCURACY,
          detectedAt: new Date().toISOString(),
          resolved: false
        })
      }

      // Check for prediction bias
      const biasAlert = await this.checkPredictionBias(currentMetrics)
      if (biasAlert) {
        alerts.push(biasAlert)
      }

      // Store alerts in database (if we had an alerts table)
      // For now, just return them

      return alerts
    } catch (error) {
      console.error('Error checking model drift:', error)
      return []
    }
  }

  /**
   * Calculate accuracy metrics from predictions
   */
  private calculateAccuracyMetrics(predictions: any[]): Omit<ModelMetrics, 'driftPercentage' | 'lastUpdated'> {
    let totalPredictions = 0
    let correctPredictions = 0
    let homeWinPredictions = 0
    let homeWinCorrect = 0
    let awayWinPredictions = 0
    let awayWinCorrect = 0
    let drawPredictions = 0
    let drawCorrect = 0
    let confidenceSum = 0
    let confidenceCorrectSum = 0

    for (const prediction of predictions) {
      const match = prediction.match
      if (!match.home_score || !match.away_score) continue

      totalPredictions++
      confidenceSum += prediction.confidence_score

      // Determine actual result
      let actualResult: 'home' | 'away' | 'draw'
      if (match.home_score > match.away_score) {
        actualResult = 'home'
      } else if (match.away_score > match.home_score) {
        actualResult = 'away'
      } else {
        actualResult = 'draw'
      }

      // Check if prediction was correct
      const isCorrect = prediction.predicted_winner === actualResult
      if (isCorrect) {
        correctPredictions++
        confidenceCorrectSum += prediction.confidence_score
      }

      // Update specific outcome metrics
      switch (prediction.predicted_winner) {
        case 'home':
          homeWinPredictions++
          if (isCorrect) homeWinCorrect++
          break
        case 'away':
          awayWinPredictions++
          if (isCorrect) awayWinCorrect++
          break
        case 'draw':
          drawPredictions++
          if (isCorrect) drawCorrect++
          break
      }
    }

    const overallAccuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0
    const homeWinAccuracy = homeWinPredictions > 0 ? homeWinCorrect / homeWinPredictions : 0
    const awayWinAccuracy = awayWinPredictions > 0 ? awayWinCorrect / awayWinPredictions : 0
    const drawAccuracy = drawPredictions > 0 ? drawCorrect / drawPredictions : 0

    // Calculate confidence calibration (how well confidence scores predict actual accuracy)
    const confidenceCalibration = totalPredictions > 0 ?
      (confidenceCorrectSum / totalPredictions) / (confidenceSum / totalPredictions) : 1

    return {
      overallAccuracy,
      totalPredictions,
      correctPredictions,
      homeWinAccuracy,
      awayWinAccuracy,
      drawAccuracy,
      confidenceCalibration: Math.min(2, Math.max(0, confidenceCalibration)) // Clamp between 0 and 2
    }
  }

  /**
   * Calculate drift percentage from baseline
   */
  private calculateDriftPercentage(currentAccuracy: number): number {
    if (currentAccuracy >= this.BASELINE_ACCURACY) {
      return 0
    }
    return (this.BASELINE_ACCURACY - currentAccuracy) / this.BASELINE_ACCURACY
  }

  /**
   * Check for prediction bias in specific outcomes
   */
  private async checkPredictionBias(currentMetrics: ModelMetrics): Promise<DriftAlert | null> {
    try {
      // Get prediction distribution from recent predictions
      const { data: recentPredictions } = await supabaseAdmin
        .from('predictions')
        .select('predicted_winner')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!recentPredictions || recentPredictions.length < 20) {
        return null
      }

      const predictionCounts = {
        home: recentPredictions.filter(p => p.predicted_winner === 'home').length,
        away: recentPredictions.filter(p => p.predicted_winner === 'away').length,
        draw: recentPredictions.filter(p => p.predicted_winner === 'draw').length
      }

      const total = recentPredictions.length
      const homePercentage = predictionCounts.home / total
      const awayPercentage = predictionCounts.away / total
      const drawPercentage = predictionCounts.draw / total

      // Check for significant bias (one outcome predicted > 60% of the time)
      const biasThreshold = 0.60
      let biasedOutcome: string | null = null
      let biasPercentage = 0

      if (homePercentage > biasThreshold) {
        biasedOutcome = 'home'
        biasPercentage = homePercentage
      } else if (awayPercentage > biasThreshold) {
        biasedOutcome = 'away'
        biasPercentage = awayPercentage
      } else if (drawPercentage > biasThreshold) {
        biasedOutcome = 'draw'
        biasPercentage = drawPercentage
      }

      if (biasedOutcome) {
        return {
          id: `prediction_bias_${Date.now()}`,
          alertType: 'prediction_bias',
          severity: biasPercentage > 0.75 ? 'high' : 'medium',
          message: `Model shows prediction bias towards ${biasedOutcome} outcomes (${(biasPercentage * 100).toFixed(1)}% of predictions)`,
          currentAccuracy: currentMetrics.overallAccuracy,
          baselineAccuracy: this.BASELINE_ACCURACY,
          detectedAt: new Date().toISOString(),
          resolved: false
        }
      }

      return null
    } catch (error) {
      console.error('Error checking prediction bias:', error)
      return null
    }
  }

  /**
   * Get model performance trends over time
   */
  async getPerformanceTrends(daysBack: number = 90): Promise<any[]> {
    try {
      const trends = []
      const daysPerPeriod = 7 // Weekly periods

      for (let i = 0; i < daysBack; i += daysPerPeriod) {
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - (i + daysPerPeriod))

        const endDate = new Date()
        endDate.setDate(endDate.getDate() - i)

        const periodMetrics = await this.calculateModelMetricsForPeriod(startDate, endDate)

        if (periodMetrics) {
          trends.push({
            period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
            accuracy: periodMetrics.overallAccuracy,
            predictions: periodMetrics.totalPredictions,
            date: endDate.toISOString()
          })
        }
      }

      return trends.reverse() // Most recent last
    } catch (error) {
      console.error('Error getting performance trends:', error)
      return []
    }
  }

  /**
   * Calculate metrics for a specific time period
   */
  private async calculateModelMetricsForPeriod(startDate: Date, endDate: Date): Promise<Omit<ModelMetrics, 'driftPercentage' | 'lastUpdated'> | null> {
    try {
      const { data: predictions, error } = await supabaseAdmin
        .from('predictions')
        .select(`
          *,
          match:matches!predictions_match_id_fkey(
            home_score,
            away_score,
            status,
            match_date
          )
        `)
        .eq('match.status', 'completed')
        .gte('match.match_date', startDate.toISOString())
        .lte('match.match_date', endDate.toISOString())

      if (error || !predictions) {
        return null
      }

      return this.calculateAccuracyMetrics(predictions)
    } catch (error) {
      console.error('Error calculating period metrics:', error)
      return null
    }
  }

  /**
   * Get prediction accuracy by confidence levels
   */
  async getAccuracyByConfidenceLevel(): Promise<any[]> {
    try {
      const confidenceBuckets = [
        { range: '0.1-0.3', min: 0.1, max: 0.3 },
        { range: '0.3-0.5', min: 0.3, max: 0.5 },
        { range: '0.5-0.7', min: 0.5, max: 0.7 },
        { range: '0.7-0.9', min: 0.7, max: 0.9 },
        { range: '0.9-1.0', min: 0.9, max: 1.0 }
      ]

      const bucketResults = []

      for (const bucket of confidenceBuckets) {
        const { data: predictions } = await supabaseAdmin
          .from('predictions')
          .select(`
            *,
            match:matches!predictions_match_id_fkey(
              home_score,
              away_score,
              status
            )
          `)
          .gte('confidence_score', bucket.min)
          .lt('confidence_score', bucket.max)
          .eq('match.status', 'completed')

        if (!predictions) continue

        let correct = 0
        let total = predictions.length

        for (const prediction of predictions) {
          const match = prediction.match
          if (!match.home_score || !match.away_score) continue

          let actualResult: 'home' | 'away' | 'draw'
          if (match.home_score > match.away_score) {
            actualResult = 'home'
          } else if (match.away_score > match.home_score) {
            actualResult = 'away'
          } else {
            actualResult = 'draw'
          }

          if (prediction.predicted_winner === actualResult) {
            correct++
          }
        }

        bucketResults.push({
          confidenceRange: bucket.range,
          predictions: total,
          accuracy: total > 0 ? correct / total : 0,
          averageConfidence: total > 0 ?
            predictions.reduce((sum, p) => sum + p.confidence_score, 0) / total : 0
        })
      }

      return bucketResults
    } catch (error) {
      console.error('Error getting accuracy by confidence level:', error)
      return []
    }
  }

  /**
   * Log model performance for monitoring
   */
  async logPerformance(): Promise<{ success: boolean; message: string }> {
    try {
      const metrics = await this.calculateModelMetrics()
      const alerts = await this.checkModelDrift()

      console.log('Model Performance Metrics:', {
        ...metrics,
        alerts: alerts.length,
        timestamp: new Date().toISOString()
      })

      if (alerts.length > 0) {
        console.warn('Model Drift Alerts:', alerts)
      }

      return {
        success: true,
        message: `Performance logged. Accuracy: ${metrics?.overallAccuracy.toFixed(3) || 'N/A'}, Alerts: ${alerts.length}`
      }
    } catch (error) {
      console.error('Error logging performance:', error)
      return {
        success: false,
        message: `Failed to log performance: ${error}`
      }
    }
  }
}