import { supabaseAdmin, Match, Team, TeamStats, Prediction } from '@/lib/supabase'

interface TeamForm {
  teamId: string
  lastFiveGames: Array<{ result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }>
  lastTenGames: Array<{ result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }>
  homeForm: Array<{ result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }>
  awayForm: Array<{ result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number }>
  currentFormPoints: number
  goalDifference: number
}

interface HeadToHeadRecord {
  totalMatches: number
  homeWins: number
  awayWins: number
  draws: number
  homeTeamGoals: number
  awayTeamGoals: number
  lastFiveMatches: Array<{ homeScore: number; awayScore: number; result: string }>
}

interface PredictionFeatures {
  homeTeamStrength: number
  awayTeamStrength: number
  homeTeamForm: number
  awayTeamForm: number
  headToHeadAdvantage: number
  homeAdvantage: number
  leaguePositionWeight: number
  goalDifferenceWeight: number
}

export class PredictionEngine {
  private readonly MODEL_VERSION = 'v1.0'
  private readonly HOME_ADVANTAGE_FACTOR = 0.15
  private readonly FORM_WEIGHT = 0.3
  private readonly H2H_WEIGHT = 0.25
  private readonly POSITION_WEIGHT = 0.2
  private readonly GOAL_DIFF_WEIGHT = 0.1

  /**
   * Generate prediction for a specific match
   */
  async generatePrediction(matchId: string): Promise<Prediction | null> {
    try {
      // Get match details with teams
      const { data: match, error: matchError } = await supabaseAdmin
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        `)
        .eq('id', matchId)
        .single()

      if (matchError || !match) {
        throw new Error(`Match not found: ${matchId}`)
      }

      // Check if prediction already exists
      const { data: existingPrediction } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('match_id', matchId)
        .single()

      if (existingPrediction) {
        return existingPrediction
      }

      // Calculate prediction
      const prediction = await this.calculateMatchPrediction(match)

      if (!prediction) {
        throw new Error('Failed to calculate prediction')
      }

      // Save prediction to database
      const { data: savedPrediction, error: saveError } = await supabaseAdmin
        .from('predictions')
        .insert(prediction)
        .select()
        .single()

      if (saveError) {
        throw new Error(`Failed to save prediction: ${saveError.message}`)
      }

      return savedPrediction
    } catch (error) {
      console.error(`Error generating prediction for match ${matchId}:`, error)
      return null
    }
  }

  /**
   * Generate predictions for all upcoming matches in a league
   */
  async generatePredictionsForLeague(leagueId: string): Promise<{ success: boolean; count: number }> {
    try {
      // Get upcoming matches (next 7 days)
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

      const { data: matches, error } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('league_id', leagueId)
        .eq('status', 'scheduled')
        .lte('match_date', sevenDaysFromNow.toISOString())
        .is('match_date', new Date().toISOString())

      if (error || !matches) {
        throw new Error(`Failed to fetch matches for league ${leagueId}`)
      }

      let successCount = 0

      for (const match of matches) {
        try {
          const prediction = await this.generatePrediction(match.id)
          if (prediction) {
            successCount++
          }
        } catch (error) {
          console.error(`Failed to generate prediction for match ${match.id}:`, error)
        }
      }

      return {
        success: true,
        count: successCount
      }
    } catch (error) {
      console.error(`Error generating predictions for league ${leagueId}:`, error)
      return {
        success: false,
        count: 0
      }
    }
  }

  /**
   * Calculate prediction for a match using statistical models
   */
  private async calculateMatchPrediction(match: any): Promise<Partial<Prediction> | null> {
    try {
      // Get team statistics
      const homeTeamStats = await this.getTeamStatistics(match.home_team_id)
      const awayTeamStats = await this.getTeamStatistics(match.away_team_id)

      if (!homeTeamStats || !awayTeamStats) {
        console.log('Team stats not available, using basic prediction')
        return this.generateBasicPrediction(match)
      }

      // Get head-to-head record
      const h2hRecord = await this.getHeadToHeadRecord(match.home_team_id, match.away_team_id)

      // Get team form
      const homeForm = await this.getTeamForm(match.home_team_id)
      const awayForm = await this.getTeamForm(match.away_team_id)

      // Calculate features
      const features = this.extractFeatures(homeTeamStats, awayTeamStats, homeForm, awayForm, h2hRecord)

      // Calculate probabilities
      const probabilities = this.calculateProbabilities(features)

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(features, h2hRecord)

      // Determine predicted winner
      const predictedWinner = this.determinePredictedWinner(probabilities)

      return {
        match_id: match.id,
        predicted_winner: predictedWinner,
        win_probability: probabilities.homeWin,
        draw_probability: probabilities.draw,
        loss_probability: probabilities.awayWin,
        confidence_score: confidenceScore,
        model_version: this.MODEL_VERSION
      }
    } catch (error) {
      console.error('Error calculating match prediction:', error)
      return null
    }
  }

  /**
   * Get team statistics for current season
   */
  private async getTeamStatistics(teamId: string): Promise<TeamStats | null> {
    try {
      const currentSeason = new Date().getFullYear()

      const { data: stats, error } = await supabaseAdmin
        .from('team_stats')
        .select('*')
        .eq('team_id', teamId)
        .eq('season', currentSeason)
        .single()

      if (error || !stats) {
        return null
      }

      return stats
    } catch (error) {
      console.error(`Error getting stats for team ${teamId}:`, error)
      return null
    }
  }

  /**
   * Get head-to-head record between two teams
   */
  private async getHeadToHeadRecord(homeTeamId: string, awayTeamId: string): Promise<HeadToHeadRecord> {
    try {
      const { data: matches, error } = await supabaseAdmin
        .from('matches')
        .select('*')
        .or(`(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
        .eq('status', 'completed')
        .order('match_date', { ascending: false })
        .limit(20)

      if (error || !matches) {
        return this.getEmptyH2HRecord()
      }

      let homeWins = 0
      let awayWins = 0
      let draws = 0
      let homeTeamGoals = 0
      let awayTeamGoals = 0

      const lastFiveMatches: Array<{ homeScore: number; awayScore: number; result: string }> = []

      for (const match of matches.slice(0, 5)) {
        const isHomeTeamHome = match.home_team_id === homeTeamId
        const homeScore = match.home_score || 0
        const awayScore = match.away_score || 0

        if (isHomeTeamHome) {
          homeTeamGoals += homeScore
          awayTeamGoals += awayScore

          if (homeScore > awayScore) homeWins++
          else if (awayScore > homeScore) awayWins++
          else draws++

          lastFiveMatches.push({
            homeScore,
            awayScore,
            result: homeScore > awayScore ? 'W' : awayScore > homeScore ? 'L' : 'D'
          })
        } else {
          homeTeamGoals += awayScore
          awayTeamGoals += homeScore

          if (awayScore > homeScore) homeWins++
          else if (homeScore > awayScore) awayWins++
          else draws++

          lastFiveMatches.push({
            homeScore,
            awayScore,
            result: awayScore > homeScore ? 'W' : homeScore > awayScore ? 'L' : 'D'
          })
        }
      }

      return {
        totalMatches: matches.length,
        homeWins,
        awayWins,
        draws,
        homeTeamGoals,
        awayTeamGoals,
        lastFiveMatches
      }
    } catch (error) {
      console.error('Error getting H2H record:', error)
      return this.getEmptyH2HRecord()
    }
  }

  /**
   * Get team form (recent performance)
   */
  private async getTeamForm(teamId: string): Promise<TeamForm> {
    try {
      const { data: matches, error } = await supabaseAdmin
        .from('matches')
        .select('*')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'completed')
        .order('match_date', { ascending: false })
        .limit(15)

      if (error || !matches) {
        return this.getEmptyTeamForm(teamId)
      }

      const allGames = []
      const homeGames = []
      const awayGames = []

      for (const match of matches) {
        const isHome = match.home_team_id === teamId
        const teamScore = isHome ? match.home_score : match.away_score
        const opponentScore = isHome ? match.away_score : match.home_score

        const result: 'W' | 'D' | 'L' = (teamScore || 0) > (opponentScore || 0) ? 'W' :
                                       (teamScore || 0) < (opponentScore || 0) ? 'L' : 'D'

        const gameData = {
          result,
          goalsFor: teamScore || 0,
          goalsAgainst: opponentScore || 0
        }

        allGames.push(gameData)
        if (isHome) {
          homeGames.push(gameData)
        } else {
          awayGames.push(gameData)
        }
      }

      // Calculate form points (W=3, D=1, L=0) for last 5
      const currentFormPoints = allGames.slice(0, 5).reduce((total, game) => {
        return total + (game.result === 'W' ? 3 : game.result === 'D' ? 1 : 0)
      }, 0)

      // Calculate goal difference for last 10 games
      const goalDifference = allGames.slice(0, 10).reduce((total, game) => {
        return total + (game.goalsFor - game.goalsAgainst)
      }, 0)

      return {
        teamId,
        lastFiveGames: allGames.slice(0, 5),
        lastTenGames: allGames.slice(0, 10),
        homeForm: homeGames.slice(0, 5),
        awayForm: awayGames.slice(0, 5),
        currentFormPoints,
        goalDifference
      }
    } catch (error) {
      console.error(`Error getting form for team ${teamId}:`, error)
      return this.getEmptyTeamForm(teamId)
    }
  }

  /**
   * Extract features from team data for model input
   */
  private extractFeatures(
    homeStats: TeamStats,
    awayStats: TeamStats,
    homeForm: TeamForm,
    awayForm: TeamForm,
    h2h: HeadToHeadRecord
  ): PredictionFeatures {
    // Calculate team strength based on points per game
    const homeTeamStrength = homeStats.matches_played > 0 ?
      homeStats.points / homeStats.matches_played : 1.5
    const awayTeamStrength = awayStats.matches_played > 0 ?
      awayStats.points / awayStats.matches_played : 1.5

    // Calculate form strength (0-3 scale)
    const homeTeamForm = homeForm.currentFormPoints / 5
    const awayTeamForm = awayForm.currentFormPoints / 5

    // Calculate H2H advantage
    const headToHeadAdvantage = h2h.totalMatches > 0 ?
      (h2h.homeWins - h2h.awayWins) / h2h.totalMatches : 0

    // Calculate league position weight (inverse, so lower position = higher weight)
    const homePositionWeight = Math.max(0, (20 - homeStats.league_position)) / 20
    const awayPositionWeight = Math.max(0, (20 - awayStats.league_position)) / 20
    const leaguePositionWeight = homePositionWeight - awayPositionWeight

    // Calculate goal difference weight
    const goalDifferenceWeight = (homeStats.goals_for - homeStats.goals_against) -
                                 (awayStats.goals_for - awayStats.goals_against)
    const normalizedGoalDiff = Math.max(-1, Math.min(1, goalDifferenceWeight / 50))

    return {
      homeTeamStrength,
      awayTeamStrength,
      homeTeamForm,
      awayTeamForm,
      headToHeadAdvantage,
      homeAdvantage: this.HOME_ADVANTAGE_FACTOR,
      leaguePositionWeight,
      goalDifferenceWeight: normalizedGoalDiff
    }
  }

  /**
   * Calculate match probabilities using weighted features
   */
  private calculateProbabilities(features: PredictionFeatures) {
    // Calculate weighted score for home team
    const homeScore =
      (features.homeTeamStrength - features.awayTeamStrength) * this.POSITION_WEIGHT +
      (features.homeTeamForm - features.awayTeamForm) * this.FORM_WEIGHT +
      features.headToHeadAdvantage * this.H2H_WEIGHT +
      features.homeAdvantage +
      features.leaguePositionWeight * this.POSITION_WEIGHT +
      features.goalDifferenceWeight * this.GOAL_DIFF_WEIGHT

    // Convert score to probabilities using softmax
    const homeWinProb = this.sigmoid(homeScore)
    const awayWinProb = this.sigmoid(-homeScore * 0.8) // Slightly favor home team
    const drawProb = Math.max(0.2, 1 - homeWinProb - awayWinProb) // Minimum 20% draw probability

    // Normalize to ensure probabilities sum to 1
    const total = homeWinProb + drawProb + awayWinProb

    return {
      homeWin: Math.round((homeWinProb / total) * 10000) / 10000,
      draw: Math.round((drawProb / total) * 10000) / 10000,
      awayWin: Math.round((awayWinProb / total) * 10000) / 10000
    }
  }

  /**
   * Calculate confidence score based on data quality and model certainty
   */
  private calculateConfidenceScore(features: PredictionFeatures, h2h: HeadToHeadRecord): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence based on data availability
    if (h2h.totalMatches >= 5) confidence += 0.1
    if (h2h.totalMatches >= 10) confidence += 0.1

    // Increase confidence based on team strength difference
    const strengthDiff = Math.abs(features.homeTeamStrength - features.awayTeamStrength)
    confidence += Math.min(0.2, strengthDiff * 0.1)

    // Increase confidence based on form consistency
    const formDiff = Math.abs(features.homeTeamForm - features.awayTeamForm)
    confidence += Math.min(0.1, formDiff * 0.05)

    return Math.min(0.95, Math.max(0.1, confidence))
  }

  /**
   * Determine predicted winner based on probabilities
   */
  private determinePredictedWinner(probabilities: { homeWin: number; draw: number; awayWin: number }): 'home' | 'away' | 'draw' {
    if (probabilities.homeWin > probabilities.draw && probabilities.homeWin > probabilities.awayWin) {
      return 'home'
    } else if (probabilities.awayWin > probabilities.draw && probabilities.awayWin > probabilities.homeWin) {
      return 'away'
    } else {
      return 'draw'
    }
  }

  /**
   * Generate basic prediction when detailed data is not available
   */
  private generateBasicPrediction(match: any): Partial<Prediction> {
    // Default to slightly favoring home team
    const homeProb = 0.45
    const drawProb = 0.25
    const awayProb = 0.30

    return {
      match_id: match.id,
      predicted_winner: 'home',
      win_probability: homeProb,
      draw_probability: drawProb,
      loss_probability: awayProb,
      confidence_score: 0.3, // Low confidence for basic predictions
      model_version: this.MODEL_VERSION
    }
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x))
  }

  /**
   * Get empty H2H record when no data available
   */
  private getEmptyH2HRecord(): HeadToHeadRecord {
    return {
      totalMatches: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      homeTeamGoals: 0,
      awayTeamGoals: 0,
      lastFiveMatches: []
    }
  }

  /**
   * Get empty team form when no data available
   */
  private getEmptyTeamForm(teamId: string): TeamForm {
    return {
      teamId,
      lastFiveGames: [],
      lastTenGames: [],
      homeForm: [],
      awayForm: [],
      currentFormPoints: 0,
      goalDifference: 0
    }
  }
}