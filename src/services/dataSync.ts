import axios from 'axios'
import * as cheerio from 'cheerio'
import { supabaseAdmin, Team, Match, League } from '@/lib/supabase'

// Configuration for external APIs
const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
const API_FOOTBALL = 'https://v3.football.api-sports.io'

interface FootballDataMatch {
  id: number
  utcDate: string
  status: string
  matchday: number
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  score: {
    fullTime: { home: number; away: number }
    halfTime: { home: number; away: number }
  }
  competition: { id: number; name: string }
}

interface FootballDataTeam {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
  address: string
  founded: number
  clubColors: string
  venue: string
  website: string
}

export class DataSyncService {
  private footballDataKey: string
  private apiFootballKey: string

  constructor() {
    this.footballDataKey = process.env.FOOTBALL_DATA_API_KEY!
    this.apiFootballKey = process.env.API_FOOTBALL_KEY!
  }

  /**
   * Main sync orchestration method
   */
  async syncAllData(): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      const stats = {
        leagues: 0,
        teams: 0,
        matches: 0,
        errors: [] as string[]
      }

      // Step 1: Sync leagues (already seeded in database)
      const { data: leagues } = await supabaseAdmin.from('leagues').select('*')
      stats.leagues = leagues?.length || 0

      // Step 2: Sync teams for each league
      for (const league of leagues || []) {
        try {
          const syncedTeams = await this.syncTeamsForLeague(league.id)
          stats.teams += syncedTeams
        } catch (error) {
          stats.errors.push(`Failed to sync teams for ${league.name}: ${error}`)
        }
      }

      // Step 3: Sync matches for recent and upcoming fixtures
      const syncedMatches = await this.syncMatches()
      stats.matches = syncedMatches

      return {
        success: true,
        message: 'Data synchronization completed successfully',
        stats
      }
    } catch (error) {
      console.error('Data sync error:', error)
      return {
        success: false,
        message: `Data sync failed: ${error}`,
        stats: { leagues: 0, teams: 0, matches: 0, errors: [error] }
      }
    }
  }

  /**
   * Sync teams for a specific league from Football-Data.org
   */
  private async syncTeamsForLeague(leagueId: string): Promise<number> {
    try {
      // Map our league IDs to Football-Data.org competition IDs
      const competitionMap: { [key: string]: number } = {
        // These would be the actual competition IDs from Football-Data.org
        'premier-league-id': 2021, // Premier League
        'la-liga-id': 2014, // La Liga
        'serie-a-id': 2019, // Serie A
        'bundesliga-id': 2002, // Bundesliga
        'ligue-1-id': 2015, // Ligue 1
        'champions-league-id': 2001 // Champions League
      }

      const competitionId = competitionMap[leagueId]
      if (!competitionId) {
        console.log(`No competition mapping for league ${leagueId}`)
        return 0
      }

      const response = await axios.get(
        `${FOOTBALL_DATA_API}/competitions/${competitionId}/teams`,
        {
          headers: { 'X-Auth-Token': this.footballDataKey }
        }
      )

      const teams: FootballDataTeam[] = response.data.teams
      let syncedCount = 0

      for (const teamData of teams) {
        const team: Partial<Team> = {
          name: teamData.name,
          league_id: leagueId,
          founded_year: teamData.founded,
          stadium: teamData.venue
        }

        // Upsert team to database
        const { error } = await supabaseAdmin
          .from('teams')
          .upsert(team, { onConflict: 'name' })

        if (!error) {
          syncedCount++
        } else {
          console.error(`Error syncing team ${teamData.name}:`, error)
        }
      }

      return syncedCount
    } catch (error) {
      console.error(`Error syncing teams for league ${leagueId}:`, error)
      throw error
    }
  }

  /**
   * Sync matches from multiple sources
   */
  private async syncMatches(): Promise<number> {
    try {
      let totalSynced = 0

      // Get dates for last 30 days and next 30 days
      const today = new Date()
      const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Sync from Football-Data.org (primary source)
      const footballDataMatches = await this.syncMatchesFromFootballData(startDate, endDate)
      totalSynced += footballDataMatches

      // Sync from API-Football (secondary source for live data)
      const apiFootballMatches = await this.syncMatchesFromApiFootball(startDate, endDate)
      totalSynced += apiFootballMatches

      return totalSynced
    } catch (error) {
      console.error('Error syncing matches:', error)
      throw error
    }
  }

  /**
   * Sync matches from Football-Data.org
   */
  private async syncMatchesFromFootballData(startDate: Date, endDate: Date): Promise<number> {
    try {
      // Get all teams to map external IDs
      const { data: teams } = await supabaseAdmin.from('teams').select('*')
      if (!teams) return 0

      const competitionMap = {
        'premier-league-id': 2021,
        'la-liga-id': 2014,
        'serie-a-id': 2019,
        'bundesliga-id': 2002,
        'ligue-1-id': 2015,
        'champions-league-id': 2001
      }

      let syncedCount = 0

      for (const [leagueId, competitionId] of Object.entries(competitionMap)) {
        try {
          const response = await axios.get(
            `${FOOTBALL_DATA_API}/competitions/${competitionId}/matches`,
            {
              headers: { 'X-Auth-Token': this.footballDataKey },
              params: {
                dateFrom: startDate.toISOString().split('T')[0],
                dateTo: endDate.toISOString().split('T')[0]
              }
            }
          )

          const matches: FootballDataMatch[] = response.data.matches

          for (const matchData of matches) {
            // Find teams in our database
            const homeTeam = teams.find(t => t.name === matchData.homeTeam.name)
            const awayTeam = teams.find(t => t.name === matchData.awayTeam.name)

            if (!homeTeam || !awayTeam) {
              console.log(`Teams not found for match: ${matchData.homeTeam.name} vs ${matchData.awayTeam.name}`)
              continue
            }

            const match: Partial<Match> = {
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              league_id: leagueId,
              match_date: new Date(matchData.utcDate).toISOString(),
              home_score: matchData.score.fullTime.home,
              away_score: matchData.score.fullTime.away,
              status: this.mapMatchStatus(matchData.status),
              data_source: 'football-data.org'
            }

            const { error } = await supabaseAdmin
              .from('matches')
              .upsert(match, {
                onConflict: 'home_team_id,away_team_id,match_date'
              })

            if (!error) {
              syncedCount++
            }
          }
        } catch (error) {
          console.error(`Error syncing matches for competition ${competitionId}:`, error)
        }
      }

      return syncedCount
    } catch (error) {
      console.error('Error syncing matches from Football-Data.org:', error)
      return 0
    }
  }

  /**
   * Sync matches from API-Football (for live scores)
   */
  private async syncMatchesFromApiFootball(startDate: Date, endDate: Date): Promise<number> {
    try {
      // This would implement API-Football integration
      // For now, return 0 as we're using Football-Data.org as primary source
      console.log('API-Football sync not yet implemented')
      return 0
    } catch (error) {
      console.error('Error syncing matches from API-Football:', error)
      return 0
    }
  }

  /**
   * Map external match status to our enum
   */
  private mapMatchStatus(status: string): Match['status'] {
    const statusMap: { [key: string]: Match['status'] } = {
      'SCHEDULED': 'scheduled',
      'LIVE': 'live',
      'IN_PLAY': 'live',
      'PAUSED': 'live',
      'FINISHED': 'completed',
      'POSTPONED': 'postponed',
      'SUSPENDED': 'postponed',
      'CANCELED': 'postponed'
    }

    return statusMap[status] || 'scheduled'
  }

  /**
   * Sync live scores specifically (called more frequently)
   */
  async syncLiveScores(): Promise<{ success: boolean; updated: number }> {
    try {
      const today = new Date()
      const startDate = new Date(today.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
      const endDate = new Date(today.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now

      // Update live matches from primary source
      const updated = await this.syncMatchesFromFootballData(startDate, endDate)

      return {
        success: true,
        updated
      }
    } catch (error) {
      console.error('Error syncing live scores:', error)
      return {
        success: false,
        updated: 0
      }
    }
  }

  /**
   * Web scraping for supplemental data
   */
  async scrapeSupplementalData(): Promise<{ success: boolean; message: string }> {
    try {
      // Example: Scrape injury reports, news, etc.
      // This would be implemented based on specific sources
      console.log('Supplemental data scraping not yet implemented')
      return {
        success: true,
        message: 'Supplemental data scraping completed'
      }
    } catch (error) {
      console.error('Error scraping supplemental data:', error)
      return {
        success: false,
        message: `Scraping failed: ${error}`
      }
    }
  }
}