import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const params = await context.params
    const teamId = params.id

    // Get team details
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select(`
        *,
        league:leagues!teams_league_id_fkey(*),
        logo:team_logos!team_logos_team_id_fkey(*)
      `)
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Get current season statistics
    const currentSeason = new Date().getFullYear()

    const { data: currentStats } = await supabaseAdmin
      .from('team_stats')
      .select('*')
      .eq('team_id', teamId)
      .eq('season', currentSeason)
      .single()

    // Get recent match history (last 10 matches)
    const { data: recentMatches } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name),
        away_team:teams!matches_away_team_id_fkey(name)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .limit(10)

    // Get upcoming fixtures (next 5 matches)
    const { data: upcomingFixtures } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name),
        away_team:teams!matches_away_team_id_fkey(name),
        prediction:predictions!predictions_match_id_fkey(*)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'scheduled')
      .order('match_date', { ascending: true })
      .limit(5)

    // Get historical performance (last 3 seasons)
    const { data: historicalStats } = await supabaseAdmin
      .from('team_stats')
      .select('*')
      .eq('team_id', teamId)
      .gte('season', currentSeason - 3)
      .lt('season', currentSeason)
      .order('season', { ascending: false })

    // Process recent matches for form analysis
    const processRecentMatches = (matches: any[]) => {
      return matches?.map(match => {
        const isHome = match.home_team_id === teamId
        const teamScore = isHome ? match.home_score : match.away_score
        const opponentScore = isHome ? match.away_score : match.home_score
        const opponent = isHome ? match.away_team?.name : match.home_team?.name

        const result = (teamScore || 0) > (opponentScore || 0) ? 'W' :
                      (teamScore || 0) < (opponentScore || 0) ? 'L' : 'D'

        return {
          id: match.id,
          date: match.match_date,
          opponent: opponent || 'Unknown',
          isHome,
          result,
          goalsFor: teamScore || 0,
          goalsAgainst: opponentScore || 0,
          goalDifference: (teamScore || 0) - (opponentScore || 0)
        }
      }) || []
    }

    // Calculate form trends
    const recentMatchesProcessed = processRecentMatches(recentMatches || [])
    const lastFiveForm = recentMatchesProcessed.slice(0, 5)
    const lastTenForm = recentMatchesProcessed.slice(0, 10)

    // Calculate form statistics
    const calculateFormStats = (matches: any[]) => {
      const stats = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }

      matches.forEach(match => {
        if (match.result === 'W') stats.wins++
        else if (match.result === 'D') stats.draws++
        else stats.losses++

        stats.goalsFor += match.goalsFor
        stats.goalsAgainst += match.goalsAgainst
      })

      return {
        ...stats,
        points: stats.wins * 3 + stats.draws,
        goalDifference: stats.goalsFor - stats.goalsAgainst,
        formString: matches.map(m => m.result).join('')
      }
    }

    const lastFiveStats = calculateFormStats(lastFiveForm)
    const lastTenStats = calculateFormStats(lastTenForm)

    // Process upcoming fixtures
    const processUpcomingFixtures = (fixtures: any[]) => {
      return fixtures?.map(fixture => {
        const isHome = fixture.home_team_id === teamId

        return {
          id: fixture.id,
          date: fixture.match_date,
          opponent: isHome ? fixture.away_team?.name : fixture.home_team?.name,
          isHome,
          prediction: fixture.prediction ? {
            predictedWinner: fixture.prediction.predicted_winner,
            confidence: fixture.prediction.confidence_score,
            probabilities: {
              win: fixture.prediction.win_probability,
              draw: fixture.prediction.draw_probability,
              loss: fixture.prediction.loss_probability
            }
          } : null
        }
      }) || []
    }

    const response = {
      team,
      currentStats,
      historicalStats,
      recentMatches: recentMatchesProcessed,
      upcomingFixtures: processUpcomingFixtures(upcomingFixtures || []),
      formAnalysis: {
        lastFive: lastFiveStats,
        lastTen: lastTenStats,
        currentForm: lastFiveStats.formString,
        homeForm: calculateFormStats(lastFiveForm.filter(m => m.isHome)),
        awayForm: calculateFormStats(lastFiveForm.filter(m => !m.isHome))
      }
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Team details API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}