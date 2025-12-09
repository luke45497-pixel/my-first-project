import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { ModelMonitoringService } from '@/services/modelMonitoring'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const include = searchParams.get('include')?.split(',') || []
    const daysBack = parseInt(searchParams.get('daysBack') || '30')

    const monitoringService = new ModelMonitoringService()

    // Get basic metrics
    const metrics = await monitoringService.calculateModelMetrics(daysBack)

    let additionalData: any = {}

    // Include additional data if requested
    if (include.includes('trends')) {
      additionalData.trends = await monitoringService.getPerformanceTrends()
    }

    if (include.includes('confidence')) {
      additionalData.confidenceAnalysis = await monitoringService.getAccuracyByConfidenceLevel()
    }

    if (include.includes('alerts')) {
      additionalData.alerts = await monitoringService.checkModelDrift()
    }

    return NextResponse.json({
      success: true,
      data: {
        ...metrics,
        ...additionalData,
        metadata: {
          daysAnalyzed: daysBack,
          timestamp: new Date().toISOString(),
          modelVersion: 'v1.0'
        }
      }
    })

  } catch (error) {
    console.error('Model performance API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    const monitoringService = new ModelMonitoringService()

    switch (action) {
      case 'log_performance':
        const result = await monitoringService.logPerformance()
        return NextResponse.json({
          success: result.success,
          message: result.message
        })

      case 'check_drift':
        const alerts = await monitoringService.checkModelDrift()
        return NextResponse.json({
          success: true,
          data: {
            alerts,
            alertCount: alerts.length,
            timestamp: new Date().toISOString()
          }
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: log_performance or check_drift' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Model performance POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}