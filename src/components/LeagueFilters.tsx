'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface League {
  id: string
  name: string
  country: string
  flag: string
}

const leagues: League[] = [
  { id: 'all', name: 'All Competitions', country: '', flag: '🌍' },
  { id: 'premier-league', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'la-liga', name: 'La Liga', country: 'Spain', flag: '🇪🇸' },
  { id: 'serie-a', name: 'Serie A', country: 'Italy', flag: '🇮🇹' },
  { id: 'bundesliga', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪' },
  { id: 'ligue-1', name: 'Ligue 1', country: 'France', flag: '🇫🇷' },
  { id: 'champions-league', name: 'Champions League', country: 'Europe', flag: '🏆' }
]

interface LeagueFiltersProps {
  selectedLeague?: string
  onLeagueChange?: (leagueId: string) => void
  showAll?: boolean
}

export default function LeagueFilters({
  selectedLeague = 'all',
  onLeagueChange,
  showAll = true
}: LeagueFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeLeague, setActiveLeague] = useState(selectedLeague)

  const filteredLeagues = showAll ? leagues : leagues.filter(l => l.id !== 'all')

  useEffect(() => {
    const leagueParam = searchParams.get('league')
    if (leagueParam) {
      setActiveLeague(leagueParam)
    }
  }, [searchParams])

  const handleLeagueChange = (leagueId: string) => {
    setActiveLeague(leagueId)

    if (onLeagueChange) {
      onLeagueChange(leagueId)
    } else {
      // Update URL params
      const params = new URLSearchParams(searchParams.toString())
      if (leagueId === 'all') {
        params.delete('league')
      } else {
        params.set('league', leagueId)
      }

      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`
      router.push(newUrl)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-1 mb-6">
      <div className="flex flex-wrap gap-1">
        {filteredLeagues.map((league) => (
          <button
            key={league.id}
            onClick={() => handleLeagueChange(league.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
              ${activeLeague === league.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }
            `}
          >
            <span className="text-lg">{league.flag}</span>
            <span>{league.name}</span>
            {league.country && (
              <span className="text-xs opacity-75 hidden sm:inline">
                ({league.country})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {activeLeague !== 'all' && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              Showing: <span className="font-medium">
                {leagues.find(l => l.id === activeLeague)?.name}
              </span>
            </span>
            <button
              onClick={() => handleLeagueChange('all')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}