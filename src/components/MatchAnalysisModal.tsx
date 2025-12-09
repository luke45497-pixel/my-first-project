'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild
} from '@headlessui/react'
import {
  XMarkIcon,
  ChartBarIcon,
  TrophyIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'

interface Match {
  id: string
  home_team: any
  away_team: any
  home_score?: number
  away_score?: number
  status: string
  match_date: string
}

interface Prediction {
  predicted_winner: 'home' | 'away' | 'draw'
  win_probability: number
  draw_probability: number
  loss_probability: number
  confidence_score: number
}

interface MatchAnalysis {
  match: Match
  headToHead: Array<{
    date: string
    homeTeam: string
    awayTeam: string
    homeScore: number
    awayScore: number
    result: string
  }>
  homeTeamForm: Array<{
    date: string
    result: string
    goalsFor: number
    goalsAgainst: number
    isHome: boolean
  }>
  awayTeamForm: Array<{
    date: string
    result: string
    goalsFor: number
    goalsAgainst: number
    isHome: boolean
  }>
  homeTeamStats?: any
  awayTeamStats?: any
  prediction?: Prediction
}

interface MatchAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  matchId: string | null
}

const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B']

export default function MatchAnalysisModal({
  isOpen,
  onClose,
  matchId
}: MatchAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && matchId) {
      fetchMatchAnalysis(matchId)
    }
  }, [isOpen, matchId])

  const fetchMatchAnalysis = async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/matches/${id}`)
      const data = await response.json()

      if (data.success) {
        setAnalysis(data.data)
      } else {
        setError(data.error || 'Failed to load match analysis')
      }
    } catch (err) {
      setError('Failed to load match analysis')
      console.error('Error fetching match analysis:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTeamFormStats = (form: any[]) => {
    const stats = { W: 0, D: 0, L: 0 }
    form.forEach(match => {
      stats[match.result as keyof typeof stats]++
    })
    return stats
  }

  const getFormTrendData = (form: any[]) => {
    return form.map((match, index) => ({
      match: index + 1,
      goalDifference: match.goalsFor - match.goalsAgainst,
      result: match.result
    }))
  }

  const getProbabilityData = (prediction?: Prediction) => {
    if (!prediction) return []

    return [
      { name: 'Home Win', value: prediction.win_probability * 100, color: '#3B82F6' },
      { name: 'Draw', value: prediction.draw_probability * 100, color: '#6B7280' },
      { name: 'Away Win', value: prediction.loss_probability * 100, color: '#EF4444' }
    ]
  }

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.8) return { level: 'High', color: 'text-green-600' }
    if (confidence >= 0.6) return { level: 'Medium', color: 'text-yellow-600' }
    return { level: 'Low', color: 'text-red-600' }
  }

  if (loading) {
    return (
      <Transition appear show={isOpen} as="div">
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <TransitionChild
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading match analysis...</p>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    )
  }

  if (error || !analysis) {
    return (
      <Transition appear show={isOpen} as="div">
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <TransitionChild
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  Error
                </DialogTitle>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </DialogPanel>
            </div>
          </div>
        </Dialog>
      </Transition>
    )
  }

  const homeFormStats = getTeamFormStats(analysis.homeTeamForm)
  const awayFormStats = getTeamFormStats(analysis.awayTeamForm)
  const probabilityData = getProbabilityData(analysis.prediction)
  const confidenceLevel = analysis.prediction ? getConfidenceLevel(analysis.prediction.confidence_score) : null

  return (
    <Transition appear show={isOpen} as="div">
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-6xl max-h-[90vh] overflow-hidden transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
              <div className="p-6 text-center">
                <h2 className="text-lg font-semibold text-gray-900">Match Analysis</h2>
                <p className="mt-2 text-gray-600">Match analysis loaded successfully.</p>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}