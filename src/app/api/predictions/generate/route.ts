import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { PredictionEngine } from '@/services/predictionEngine'

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
    const { matchId, leagueId } = body

    if (!matchId && !leagueId) {
      return NextResponse.json(
        { success: false, error: 'Either matchId or leagueId is required' },
        { status: 400 }
      )
    }

    const predictionEngine = new PredictionEngine()

    if (matchId) {
      // Generate prediction for specific match
      const prediction = await predictionEngine.generatePrediction(matchId)

      if (!prediction) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate prediction for match' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Prediction generated successfully',
        data: prediction
      })

    } else if (leagueId) {
      // Generate predictions for all upcoming matches in league
      const result = await predictionEngine.generatePredictionsForLeague(leagueId)

      return NextResponse.json({
        success: result.success,
        message: result.success ?
          `Generated ${result.count} predictions for league` :
          'Failed to generate predictions for league',
        data: {
          leagueId,
          predictionsGenerated: result.count
        }
      })
    }

  } catch (error) {
    console.error('Prediction generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Prediction generation endpoint available',
      usage: {
        generateForMatch: 'POST with { matchId: "uuid" }',
        generateForLeague: 'POST with { leagueId: "uuid" }'
      }
    })

  } catch (error) {
    console.error('Prediction endpoint error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}