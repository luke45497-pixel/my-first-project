'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  ChartBarIcon,
  ClockIcon,
  PlayIcon
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

interface MatchCardProps {
  match: Match
  onAnalysisClick?: (matchId: string) => void
  compact?: boolean
}

export default function MatchCard({ match, onAnalysisClick, compact = false }: MatchCardProps) {
  const [imageError, setImageError] = useState<{ home: boolean; away: boolean }>({
    home: false,
    away: false
  })

  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  const getTeamLogoUrl = (teamName: string) => {
    // This would integrate with the logo service when implemented
    // For now, return a placeholder or team initials-based logo
    return null
  }

  const getStatusDisplay = () => {
    switch (match.status) {
      case 'live':
        return (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-red-600">LIVE</span>
          </div>
        )
      case 'completed':
        return <span className="text-xs font-medium text-gray-500">FT</span>
      case 'postponed':
        return <span className="text-xs font-medium text-orange-600">PPD</span>
      default:
        return <span className="text-xs font-medium text-gray-500">UPCOMING</span>
    }
  }

  const getScoreDisplay = () => {
    if (match.status === 'scheduled') {
      return format(new Date(match.match_date), 'HH:mm')
    }

    if (match.home_score !== undefined && match.away_score !== undefined) {
      return `${match.home_score} - ${match.away_score}`
    }

    return 'vs'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100'
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getPredictionDisplay = () => {
    if (!match.prediction) return null

    const { predicted_winner, confidence_score } = match.prediction
    const confidencePercent = Math.round(confidence_score * 100)

    return (
      <div className="mt-3 p-2 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Prediction</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getConfidenceColor(confidence_score)}`}>
            {confidencePercent}%
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="font-medium">
            {predicted_winner === 'home' ? match.home_team.name :
             predicted_winner === 'away' ? match.away_team.name : 'Draw'}
          </span>
        </div>

        {/* Probability bars */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-12 text-xs text-gray-600">Home</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${match.prediction.win_probability * 100}%` }}
              ></div>
            </div>
            <span className="w-8 text-xs text-gray-600">
              {Math.round(match.prediction.win_probability * 100)}%
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-12 text-xs text-gray-600">Draw</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-500 h-2 rounded-full"
                style={{ width: `${match.prediction.draw_probability * 100}%` }}
              ></div>
            </div>
            <span className="w-8 text-xs text-gray-600">
              {Math.round(match.prediction.draw_probability * 100)}%
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-12 text-xs text-gray-600">Away</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${match.prediction.loss_probability * 100}%` }}
              ></div>
            </div>
            <span className="w-8 text-xs text-gray-600">
              {Math.round(match.prediction.loss_probability * 100)}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {getTeamInitials(match.home_team.name)}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {match.home_team.name}
                </span>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">
                  {getScoreDisplay()}
                </div>
                {getStatusDisplay()}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900 text-right">
                  {match.away_team.name}
                </span>
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {getTeamInitials(match.away_team.name)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
      {/* Match header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusDisplay()}
          <span className="text-xs text-gray-500">
            {format(new Date(match.match_date), 'MMM dd, yyyy')}
          </span>
        </div>

        {onAnalysisClick && (
          <button
            onClick={() => onAnalysisClick(match.id)}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-xs font-medium"
          >
            <ChartBarIcon className="w-3 h-3" />
            <span>Full Analysis</span>
          </button>
        )}
      </div>

      {/* Teams and score */}
      <div className="flex items-center justify-between mb-3">
        {/* Home team */}
        <div className="flex items-center space-x-3 flex-1">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
            {getTeamInitials(match.home_team.name)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{match.home_team.name}</h3>
            {match.status === 'live' && (
              <p className="text-xs text-green-600 font-medium">Home</p>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="text-center px-4">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {getScoreDisplay()}
          </div>
          {match.status === 'live' && (
            <div className="flex items-center justify-center space-x-1 text-xs text-red-600">
              <ClockIcon className="w-3 h-3" />
              <span>Live</span>
            </div>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center space-x-3 flex-1 justify-end">
          <div className="text-right">
            <h3 className="font-semibold text-gray-900">{match.away_team.name}</h3>
            {match.status === 'live' && (
              <p className="text-xs text-green-600 font-medium">Away</p>
            )}
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
            {getTeamInitials(match.away_team.name)}
          </div>
        </div>
      </div>

      {/* Prediction */}
      {getPredictionDisplay()}

      {/* Action buttons */}
      {onAnalysisClick && match.prediction && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => onAnalysisClick(match.id)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <ChartBarIcon className="w-4 h-4" />
            <span>Detailed Analysis</span>
          </button>
        </div>
      )}
    </div>
  )
}