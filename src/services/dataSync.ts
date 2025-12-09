
import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabaseAdmin, Team, Match, League } from '@/lib/supabase';

// Configuration for external APIs
const FOOTBALL_DATA_API = 'https://api.football-data.org/v4';

// --- Interface Definitions for API Responses ---
interface FootballDataMatch {
    id: number;
    utcDate: string;
    status: string;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
    score: { fullTime: { home: number | null; away: number | null } };
    competition: { id: number };
}

interface FootballDataTeam {
    id: number;
    name: string;
    tla: string;
    crest: string;
    founded: number;
    venue: string;
}

// --- Main Data Synchronization Service ---
export class DataSyncService {
    private footballDataKey: string;

    constructor() {
        this.footballDataKey = process.env.FOOTBALL_DATA_API_KEY!;
        if (!this.footballDataKey) {
            console.error("FOOTBALL_DATA_API_KEY is not set. Data sync will fail.");
        }
    }

    /**
     * Main sync orchestration method.
     * Fetches and stores leagues, teams, and matches.
     */
    async syncAllData(): Promise<{ success: boolean; message: string; stats: any }> {
        const stats = { leagues: 0, teams: 0, matches: 0, logos: 0, errors: [] as string[] };
        try {
            // Step 1: Fetch all leagues from our database to get their external IDs
            const { data: leagues, error: leagueError } = await supabaseAdmin.from('leagues').select('*');
            if (leagueError) throw new Error(`Failed to fetch leagues from DB: ${leagueError.message}`);

            // In the Supabase SQL Editor, you need to add the external IDs for the leagues you want to track.
            // For example: UPDATE leagues SET external_id = '2021' WHERE name = 'Premier League';
            const externalLeagueIds = leagues.map(l => l.external_id).filter(id => id).join(',');
            if (!externalLeagueIds) {
                return { success: true, message: "No leagues with external_id found in the database. Please run the setup SQL.", stats };
            }
            stats.leagues = leagues.length;

            // Step 2: Sync Matches and the teams involved in them
            const { syncedMatches, syncedTeams } = await this.syncMatchesAndTeams(leagues, externalLeagueIds);
            stats.matches = syncedMatches;
            stats.teams = syncedTeams;

            return {
                success: true,
                message: 'Data synchronization completed successfully.',
                stats
            };

        } catch (error: any) {
            console.error('Core data sync error:', error);
            stats.errors.push(error.message);
            return {
                success: false,
                message: `Data sync failed: ${error.message}`,
                stats
            };
        }
    }

    /**
     * Syncs matches and teams from Football-Data.org for a given set of competitions.
     */
    private async syncMatchesAndTeams(leagues: League[], externalLeagueIds: string): Promise<{ syncedMatches: number, syncedTeams: number }> {
        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateTo.getDate() - 30); // Fetch last 30 days
        dateTo.setDate(dateTo.getDate() + 30);   // Fetch next 30 days

        try {
            const response = await axios.get(`${FOOTBALL_DATA_API}/matches`, {
                headers: { 'X-Auth-Token': this.footballDataKey },
                params: {
                    competitions: externalLeagueIds,
                    dateFrom: dateFrom.toISOString().split('T')[0],
                    dateTo: dateTo.toISOString().split('T')[0],
                }
            });

            const apiMatches: FootballDataMatch[] = response.data.matches;
            if (!apiMatches || apiMatches.length === 0) return { syncedMatches: 0, syncedTeams: 0 };

            // --- Team Syncing ---
            const allApiTeams = new Map<number, FootballDataTeam>();
            apiMatches.forEach(match => {
                // The /matches endpoint returns a simplified team object. We need to cast it.
                if(match.homeTeam.id) allApiTeams.set(match.homeTeam.id, { ...match.homeTeam, crest: '' } as FootballDataTeam);
                if(match.awayTeam.id) allApiTeams.set(match.awayTeam.id, { ...match.awayTeam, crest: '' } as FootballDataTeam);
            });

            const teamsToUpsert = Array.from(allApiTeams.values()).map(apiTeam => ({
                external_id: apiTeam.id.toString(),
                name: apiTeam.name,
            }));

            const { count: syncedTeamsCount, error: teamError } = await supabaseAdmin
                .from('teams')
                .upsert(teamsToUpsert, { onConflict: 'external_id', ignoreDuplicates: false });

            if (teamError) throw new Error(`Failed to upsert teams: ${teamError.message}`);

            // --- Match Syncing ---
            // Refetch our teams to create a map from external_id to our internal UUID
            const { data: ourTeams } = await supabaseAdmin.from('teams').select('id, external_id');
            const teamExternalIdMap = new Map(ourTeams?.map(t => [t.external_id, t.id]));
            const leagueExternalIdMap = new Map(leagues.map(l => [l.external_id, l.id]));

            const matchesToUpsert = apiMatches.map(match => {
                const homeTeamId = teamExternalIdMap.get(match.homeTeam.id.toString());
                const awayTeamId = teamExternalIdMap.get(match.awayTeam.id.toString());
                const leagueId = leagueExternalIdMap.get(match.competition.id.toString());

                if (!homeTeamId || !awayTeamId || !leagueId) return null;

                return {
                    external_id: match.id.toString(),
                    home_team_id: homeTeamId,
                    away_team_id: awayTeamId,
                    league_id: leagueId,
                    match_date: new Date(match.utcDate).toISOString(),
                    status: this.mapMatchStatus(match.status),
                    home_score: match.score.fullTime.home,
                    away_score: match.score.fullTime.away,
                    data_source: 'football-data.org',
                };
            }).filter(Boolean); // Filter out nulls

            if (matchesToUpsert.length === 0) return { syncedMatches: 0, syncedTeams: syncedTeamsCount || 0 };

            const { count: syncedMatchesCount, error: matchError } = await supabaseAdmin
                .from('matches')
                .upsert(matchesToUpsert as Match[], { onConflict: 'external_id, data_source' });

            if (matchError) throw new Error(`Failed to upsert matches: ${matchError.message}`);

            return { syncedMatches: syncedMatchesCount || 0, syncedTeams: syncedTeamsCount || 0 };

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message;
            console.error('Error syncing matches from Football-Data.org:', errorMessage);
            throw new Error(`Football-Data.org API Error: ${errorMessage}`);
        }
    }

    private mapMatchStatus(status: string): Match['status'] {
        const statusMap: { [key: string]: Match['status'] } = {
            'SCHEDULED': 'scheduled',
            'LIVE': 'live',
            'IN_PLAY': 'live',
            'PAUSED': 'live',
            'FINISHED': 'completed',
            'POSTPONED': 'postponed',
            'SUSPENDED': 'postponed',
            'CANCELED': 'postponed',
        };
        return statusMap[status.toUpperCase()] || 'scheduled';
    }
}
