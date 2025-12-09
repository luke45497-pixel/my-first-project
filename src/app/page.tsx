'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import MatchCard from '@/components/MatchCard'
import LeagueFilters from '@/components/LeagueFilters'
import MatchAnalysisModal from '@/components/MatchAnalysisModal'
import ModelPerformanceSidebar from '@/components/ModelPerformanceSidebar'
import {
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

interface Match {
  id: string
  home_team: { id: string; name: string }
  away_team: { id: string; name: string }
  home_score?: number
  away_score?: number
  status: 'scheduled' | 'live' | 'completed' | 'postponed'
  match_date: string
  prediction?: {
    predicted_winner: 'home' | 'away' | 'draw'
    win_probability: number
    draw_probability: number
    loss_probability: number
    confidence_score: number
  }
}

function HomePage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [matches, setMatches] = useState<{
    live: Match[]
    upcoming: Match[]
    recent: Match[]
  }>({ live: [], upcoming: [], recent: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<string>('all')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)

  const searchParams = useSearchParams()
  const leagueParam = searchParams.get('league')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (leagueParam) {
      setSelectedLeague(leagueParam)
    }
  }, [leagueParam])

  useEffect(() => {
    if (user) {
      fetchMatches()
      // Set up auto-refresh for live matches
      const interval = setInterval(() => {
        fetchMatches(true) // Silent refresh
      }, 30000) // Every 30 seconds

      return () => clearInterval(interval)
    }
  }, [selectedLeague, user])

  const fetchMatches = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    setError(null)

    try {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      // Fetch live matches
      const liveResponse = await fetch(`/api/matches?status=live${selectedLeague !== 'all' ? `&league=${selectedLeague}` : ''}`)
      const liveData = await liveResponse.json()

      // Fetch upcoming matches (next 7 days)
      const upcomingResponse = await fetch(`/api/matches?status=scheduled&dateFrom=${now.toISOString()}&dateTo=${sevenDaysFromNow.toISOString()}${selectedLeague !== 'all' ? `&league=${selectedLeague}` : ''}&limit=20`)
      const upcomingData = await upcomingResponse.json()

      // Fetch recent matches (last 24 hours)
      const recentResponse = await fetch(`/api/matches?status=completed&dateFrom=${oneDayAgo.toISOString()}&dateTo=${now.toISOString()}${selectedLeague !== 'all' ? `&league=${selectedLeague}` : ''}&limit=15`)
      const recentData = await recentResponse.json()

      if (liveData.success && upcomingData.success && recentData.success) {
        setMatches({
          live: liveData.data || [],
          upcoming: upcomingData.data || [],
          recent: recentData.data || []
        })
        setLastUpdated(new Date())
      } else {
        setError('Failed to fetch matches')
      }
    } catch (err) {
      setError('Failed to fetch matches')
      console.error('Error fetching matches:', err)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleSyncData = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/data/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ syncType: 'live' })
      })
      const data = await response.json()

      if (data.success) {
        // Refresh matches after sync
        await fetchMatches()
      }
    } catch (err) {
      console.error('Error syncing data:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handleAnalysisClick = (matchId: string) => {
    setSelectedMatchId(matchId)
    setIsAnalysisModalOpen(true)
  }

  const getEmptyStateMessage = () => {
    if (selectedLeague !== 'all') {
      return 'No matches found for this competition'
    }
    return 'No matches available at the moment'
  }

  if (authLoading || (loading && matches.live.length === 0 && matches.upcoming.length === 0 && matches.recent.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">{authLoading ? 'Checking authentication...' : 'Loading matches...'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Football Predictions</h1>
              <p className="text-sm text-gray-600">Data-driven match predictions and analysis</p>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="text-sm text-gray-600">
                  Welcome, <span className="font-medium text-gray-900">{user.username}</span>
                </div>
              )}
              {lastUpdated && (
                <div className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              <button
                onClick={handleSyncData}
                disabled={syncing}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* League Filters */}
            <LeagueFilters
              selectedLeague={selectedLeague}
              onLeagueChange={setSelectedLeague}
            />

            {/* Error State */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Matches */}
            {matches.live.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <h2 className="text-xl font-semibold text-gray-900">Live Matches</h2>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                    {matches.live.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.live.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onAnalysisClick={handleAnalysisClick}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Matches */}
            <section className="mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-900">Upcoming Fixtures</h2>
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  {matches.upcoming.length}
                </span>
              </div>

              {matches.upcoming.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.upcoming.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onAnalysisClick={handleAnalysisClick}
                      compact={matches.upcoming.length > 6}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ClockIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No upcoming fixtures</p>
                </div>
              )}
            </section>

            {/* Recent Results */}
            <section>
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircleIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-900">Recent Results</h2>
                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  {matches.recent.length}
                </span>
              </div>

              {matches.recent.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.recent.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onAnalysisClick={handleAnalysisClick}
                      compact={matches.recent.length > 6}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No recent results</p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Model Performance Sidebar */}
              <ModelPerformanceSidebar />

              {/* Quick Stats */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Live Matches</span>
                    <span className="text-sm font-medium text-red-600">{matches.live.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Upcoming</span>
                    <span className="text-sm font-medium text-blue-600">{matches.upcoming.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Recent Results</span>
                    <span className="text-sm font-medium text-green-600">{matches.recent.length}</span>
                  </div>
                </div>
              </div>

              {/* Predictions Summary */}
              {(matches.upcoming.length > 0 || matches.live.length > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Predictions Summary</h3>
                  <div className="space-y-2">
                    {matches.live.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Live Predictions</span>
                        <span className="font-medium text-green-600">
                          {matches.live.filter(m => m.prediction).length}/{matches.live.length}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Upcoming Predictions</span>
                      <span className="font-medium text-blue-600">
                        {matches.upcoming.filter(m => m.prediction).length}/{matches.upcoming.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Match Analysis Modal */}
      <MatchAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        matchId={selectedMatchId}
      />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <HomePage />
    </Suspense>
  )
}