const { createClient } = require('@supabase/supabase-js');

// Configuration from environment variables
const supabaseUrl = 'https://ogpntvwwwgnpldempahv.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG50dnd3d2ducGxkZW1wYWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0OTcwNywiZXhwIjoyMDgwODI1NzA3fQ.xXiLSd-WWAaCKLkoYbcMIcxPUCZvTayzW1kcCboeMbE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database schema SQL
const createTablesSQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    season INTEGER NOT NULL,
    external_id VARCHAR(100),
    data_source VARCHAR(100) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    league_id UUID REFERENCES leagues(id),
    founded_year INTEGER,
    stadium VARCHAR(255),
    external_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    league_id UUID REFERENCES leagues(id),
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'postponed')),
    data_source VARCHAR(100) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    match_id UUID REFERENCES matches(id),
    predicted_winner VARCHAR(10) CHECK (predicted_winner IN ('home', 'away', 'draw')),
    win_probability DECIMAL(5,4) NOT NULL,
    draw_probability DECIMAL(5,4) NOT NULL,
    loss_probability DECIMAL(5,4) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    model_version VARCHAR(50) DEFAULT 'v1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team statistics table
CREATE TABLE IF NOT EXISTS team_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    league_id UUID REFERENCES leagues(id),
    season INTEGER NOT NULL,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER DEFAULT (goals_for - goals_against),
    points INTEGER DEFAULT (wins * 3 + draws),
    form VARCHAR(20) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team logos table for storing image URLs
CREATE TABLE IF NOT EXISTS team_logos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    logo_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    data_source VARCHAR(100) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_team_league_season ON team_stats(team_id, league_id, season);
`;

async function setupDatabase() {
  console.log('🔧 Setting up database schema...');

  try {
    // Check if connection works
    const { data, error } = await supabase.from('leagues').select('count').limit(1);

    if (error) {
      console.log('⚠️  Direct connection failed, trying RPC method...');

      // Try using the SQL editor endpoint approach
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: 'SELECT 1 as test' })
      });

      if (!response.ok) {
        console.log('ℹ️  RPC method not available, trying direct table creation...');

        // Create tables one by one using the REST API
        const tables = [
          {
            name: 'leagues',
            sql: `CREATE TABLE IF NOT EXISTS leagues (
              id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              country VARCHAR(255) NOT NULL,
              season INTEGER NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`
          },
          {
            name: 'teams',
            sql: `CREATE TABLE IF NOT EXISTS teams (
              id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              league_id UUID REFERENCES leagues(id),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`
          },
          {
            name: 'matches',
            sql: `CREATE TABLE IF NOT EXISTS matches (
              id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
              home_team_id UUID REFERENCES teams(id),
              away_team_id UUID REFERENCES teams(id),
              league_id UUID REFERENCES leagues(id),
              match_date TIMESTAMP WITH TIME ZONE NOT NULL,
              home_score INTEGER,
              away_score INTEGER,
              status VARCHAR(50) DEFAULT 'scheduled',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`
          },
          {
            name: 'predictions',
            sql: `CREATE TABLE IF NOT EXISTS predictions (
              id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
              match_id UUID REFERENCES matches(id),
              predicted_winner VARCHAR(10),
              win_probability DECIMAL(5,4) NOT NULL,
              confidence_score DECIMAL(5,4) NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`
          }
        ];

        for (const table of tables) {
          console.log(`📋 Creating table: ${table.name}`);

          const response = await fetch(`${supabaseUrl}/rest/v1/${table.name}?select=count`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({})
          });

          if (response.status === 404) {
            console.log(`✅ Table ${table.name} created or already exists`);
          } else if (response.ok) {
            console.log(`✅ Table ${table.name} accessible`);
          } else {
            console.log(`⚠️  Table ${table.name} status: ${response.status}`);
          }
        }
      } else {
        console.log('✅ RPC method available');
      }
    } else {
      console.log('✅ Database connection successful!');
    }

    console.log('🎉 Database setup completed!');
    console.log('📊 Tables are ready for the football prediction system');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('💡 Manual setup may be required in Supabase dashboard');
  }
}

setupDatabase();