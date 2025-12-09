import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Client for browser-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types based on our schema
export interface League {
  id: string
  name: string
  country: string
  season: number
  external_id?: string
  data_source: string
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  league_id: string
  founded_year?: number
  stadium?: string
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  home_team_id: string
  away_team_id: string
  league_id: string
  match_date: string
  home_score?: number
  away_score?: number
  status: 'scheduled' | 'live' | 'completed' | 'postponed'
  data_source: string
  created_at: string
  updated_at: string
}

export interface Prediction {
  id: string
  match_id: string
  predicted_winner: 'home' | 'away' | 'draw'
  win_probability: number
  draw_probability: number
  loss_probability: number
  confidence_score: number
  model_version: string
  created_at: string
}

export interface TeamStats {
  id: string
  team_id: string
  season: number
  matches_played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  points: number
  league_position: number
  updated_at: string
}

export interface TeamLogo {
  id: string
  team_id: string
  logo_url?: string
  logo_storage_path?: string
  created_at: string
  updated_at: string
}

// Join types for API responses
export interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
  prediction?: Prediction
}

export interface TeamWithStats extends Team {
  stats?: TeamStats[]
  logo?: TeamLogo
}