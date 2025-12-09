import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

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
    const status = searchParams.get('status')
    const league = searchParams.get('league')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let query = supabaseAdmin
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name),
        away_team:teams!matches_away_team_id_fkey(id, name),
        prediction:predictions!predictions_match_id_fkey(
          predicted_winner,
          win_probability,
          draw_probability,
          loss_probability,
          confidence_score
        )
      `)
      .order('match_date', { ascending: true })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (league) {
      query = query.eq('league_id', league)
    }

    if (dateFrom) {
      query = query.gte('match_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('match_date', dateTo)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: matches, error, count } = await query

    if (error) {
      console.error('Error fetching matches:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch matches' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('matches')
      .select('*', { count: 'exact', head: true })

    // Apply same filters as main query
    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    if (league) {
      countQuery = countQuery.eq('league_id', league)
    }

    if (dateFrom) {
      countQuery = countQuery.gte('match_date', dateFrom)
    }

    if (dateTo) {
      countQuery = countQuery.lte('match_date', dateTo)
    }

    const { count: totalCount } = await countQuery

    return NextResponse.json({
      success: true,
      data: matches || [],
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        hasMore: (offset + limit) < (totalCount || 0)
      }
    })

  } catch (error) {
    console.error('Matches API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}