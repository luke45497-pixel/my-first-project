-- Create leagues table first
CREATE TABLE IF NOT EXISTS leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(100),
  logo_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  founded_year INTEGER,
  stadium VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  home_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'postponed')),
  data_source VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT home_away_different CHECK (home_team_id != away_team_id)
);

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_winner VARCHAR(10) NOT NULL CHECK (predicted_winner IN ('home', 'away', 'draw')),
  win_probability DECIMAL(5,4) NOT NULL CHECK (win_probability >= 0 AND win_probability <= 1),
  draw_probability DECIMAL(5,4) NOT NULL CHECK (draw_probability >= 0 AND draw_probability <= 1),
  loss_probability DECIMAL(5,4) NOT NULL CHECK (loss_probability >= 0 AND loss_probability <= 1),
  confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  model_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT probabilities_sum CHECK (win_probability + draw_probability + loss_probability = 1.0)
);

-- Create team_stats table
CREATE TABLE IF NOT EXISTS team_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  league_position INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_team_season UNIQUE (team_id, season)
);

-- Create team_logos table
CREATE TABLE IF NOT EXISTS team_logos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
  logo_url VARCHAR(500),
  logo_storage_path VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_team ON team_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_season ON team_stats(season);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_stats_updated_at BEFORE UPDATE ON team_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_logos_updated_at BEFORE UPDATE ON team_logos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial league data
INSERT INTO leagues (name, country) VALUES
('Premier League', 'England'),
('La Liga', 'Spain'),
('Serie A', 'Italy'),
('Bundesliga', 'Germany'),
('Ligue 1', 'France'),
('Champions League', 'Europe')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_logos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - For demo purposes, allowing read access to all
CREATE POLICY "Enable read access for all users" ON leagues FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON teams FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON matches FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON predictions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON team_stats FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON team_logos FOR SELECT USING (true);

-- Allow all operations for authenticated users (you may want to restrict this in production)
CREATE POLICY "Enable all operations for authenticated users" ON leagues FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all operations for authenticated users" ON teams FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all operations for authenticated users" ON matches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all operations for authenticated users" ON predictions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all operations for authenticated users" ON team_stats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all operations for authenticated users" ON team_logos FOR ALL USING (auth.role() = 'authenticated');