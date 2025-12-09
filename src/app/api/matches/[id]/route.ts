import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface DetailedMatchResponse {
  match: any
  headToHead: any[]
  homeTeamForm: any[]
  awayTeamForm: any[]
  homeTeamStats: any
  awayTeamStats: any
  prediction: any
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const matchId = params.id
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get match details with teams and prediction
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        prediction:predictions!predictions_match_id_fkey(*)
      `)
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      )
    }

    // Get head-to-head history
    const { data: h2hMatches } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name),
        away_team:teams!matches_away_team_id_fkey(name)
      `)
      .or(`(home_team_id.eq.${match.home_team_id},away_team_id.eq.${match.away_team_id}),(home_team_id.eq.${match.away_team_id},away_team_id.eq.${match.home_team_id})`)
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .limit(10)

    // Get team forms (last 5 matches for each team)
    const { data: homeTeamForm } = await supabaseAdmin
      .from('matches')
      .select('*')
      .or(`home_team_id.eq.${match.home_team_id},away_team_id.eq.${match.home_team_id}`)
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .limit(5)

    const { data: awayTeamForm } = await supabaseAdmin
      .from('matches')
      .select('*')
      .or(`home_team_id.eq.${match.away_team_id},away_team_id.eq.${match.away_team_id}`)
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .limit(5)

    // Get current season team statistics
    const currentSeason = new Date().getFullYear()

    const { data: homeTeamStats } = await supabaseAdmin
      .from('team_stats')
      .select('*')
      .eq('team_id', match.home_team_id)
      .eq('season', currentSeason)
      .single()

    const { data: awayTeamStats } = await supabaseAdmin
      .from('team_stats')
      .select('*')
      .eq('team_id', match.away_team_id)
      .eq('season', currentSeason)
      .single()

    // Process head-to-head data
    const processedH2H = h2hMatches?.map(h2hMatch => {
      const isHomeTeamHome = h2hMatch.home_team_id === match.home_team_id
      const homeScore = h2hMatch.home_score || 0
      const awayScore = h2hMatch.away_score || 0

      return {
        id: h2hMatch.id,
        date: h2hMatch.match_date,
        homeTeam: h2hMatch.home_team?.name,
        awayTeam: h2hMatch.away_team?.name,
        homeScore,
        awayScore,
        result: isHomeTeamHome ?
          (homeScore > awayScore ? 'W' : awayScore > homeScore ? 'L' : 'D') :
          (awayScore > homeScore ? 'W' : homeScore > awayScore ? 'L' : 'D')
      }
    }) || []

    // Process team form data
    const processForm = (matches: any[], teamId: string) => {
      return matches?.map(formMatch => {
        const isHome = formMatch.home_team_id === teamId
        const teamScore = isHome ? formMatch.home_score : formMatch.away_score
        const opponentScore = isHome ? formMatch.away_score : formMatch.home_score

        return {
          date: formMatch.match_date,
          result: (teamScore || 0) > (opponentScore || 0) ? 'W' :
                  (teamScore || 0) < (opponentScore || 0) ? 'L' : 'D',
          goalsFor: teamScore || 0,
          goalsAgainst: opponentScore || 0,
          isHome
        }
      }) || []
    }

    const response: DetailedMatchResponse = {
      match,
      headToHead: processedH2H,
      homeTeamForm: processForm(homeTeamForm || [], match.home_team_id),
      awayTeamForm: processForm(awayTeamForm || [], match.away_team_id),
      homeTeamStats,
      awayTeamStats,
      prediction: match.prediction
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Match details API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}