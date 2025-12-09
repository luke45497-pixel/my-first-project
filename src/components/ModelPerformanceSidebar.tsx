'use client'

import { useState, useEffect } from 'react'
import {
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'

interface ModelMetrics {
  overallAccuracy: number
  totalPredictions: number
  correctPredictions: number
  homeWinAccuracy: number
  awayWinAccuracy: number
  drawAccuracy: number
  confidenceCalibration: number
  driftPercentage: number
  lastUpdated: string
}

interface TrendData {
  period: string
  accuracy: number
  predictions: number
  date: string
}

interface AlertData {
  id: string
  alertType: string
  severity: 'low' | 'medium' | 'high'
  message: string
  currentAccuracy: number
  baselineAccuracy: number
}

interface ModelPerformanceSidebarProps {
  className?: string
}

export default function ModelPerformanceSidebar({ className = '' }: ModelPerformanceSidebarProps) {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('overview')

  useEffect(() => {
    fetchModelPerformance()
  }, [])

  const fetchModelPerformance = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch basic metrics
      const metricsResponse = await fetch('/api/model/performance?include=trends,alerts')
      const data = await metricsResponse.json()

      if (data.success) {
        setMetrics(data.data)
        setTrends(data.data.trends || [])
        setAlerts(data.data.alerts || [])
      } else {
        setError(data.error || 'Failed to load model performance')
      }
    } catch (err) {
      setError('Failed to load model performance')
      console.error('Error fetching model performance:', err)
    } finally {
      setLoading(false)
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.6) return 'text-green-600'
    if (accuracy >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAccuracyBgColor = (accuracy: number) => {
    if (accuracy >= 0.6) return 'bg-green-100'
    if (accuracy >= 0.5) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getDriftStatus = (driftPercentage: number) => {
    if (driftPercentage === 0) {
      return {
        icon: CheckCircleIcon,
        text: 'No Drift',
        color: 'text-green-600'
      }
    } else if (driftPercentage <= 0.05) {
      return {
        icon: CheckCircleIcon,
        text: 'Minor Drift',
        color: 'text-yellow-600'
      }
    } else {
      return {
        icon: ExclamationTriangleIcon,
        text: 'Significant Drift',
        color: 'text-red-600'
      }
    }
  }

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'accuracy_drift':
        return ArrowTrendingDownIcon
      case 'prediction_bias':
        return ExclamationTriangleIcon
      default:
        return ExclamationTriangleIcon
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  if (loading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="text-center text-red-600">
          <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-gray-500">No performance data available</p>
      </div>
    )
  }

  const driftStatus = getDriftStatus(metrics.driftPercentage)
  const DriftIcon = driftStatus.icon

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <SparklesIcon className="h-5 w-5 mr-2 text-blue-600" />
            Model Performance
          </h3>
          <button
            onClick={fetchModelPerformance}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Section */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setExpandedSection(expandedSection === 'overview' ? null : 'overview')}
          className="w-full flex items-center justify-between text-left"
        >
          <h4 className="text-sm font-medium text-gray-700">Overview</h4>
          <div className={`transform transition-transform ${expandedSection === 'overview' ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'overview' && (
          <div className="mt-4 space-y-3">
            {/* Overall Accuracy */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Overall Accuracy</span>
                <span className={`text-sm font-medium ${getAccuracyColor(metrics.overallAccuracy)}`}>
                  {(metrics.overallAccuracy * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${metrics.overallAccuracy >= 0.6 ? 'bg-green-500' : metrics.overallAccuracy >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${metrics.overallAccuracy * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Total Predictions */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Predictions</span>
              <span className="text-sm font-medium text-gray-900">{metrics.totalPredictions}</span>
            </div>

            {/* Success Rate */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Success Rate</span>
              <span className={`text-sm px-2 py-1 rounded-full font-medium ${getAccuracyBgColor(metrics.overallAccuracy)} ${getAccuracyColor(metrics.overallAccuracy)}`}>
                {metrics.correctPredictions}/{metrics.totalPredictions}
              </span>
            </div>

            {/* Drift Status */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <DriftIcon className={`h-4 w-4 ${driftStatus.color}`} />
                <span className="text-sm text-gray-700">Drift Status</span>
              </div>
              <span className={`text-sm font-medium ${driftStatus.color}`}>
                {driftStatus.text}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Performance by Outcome */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setExpandedSection(expandedSection === 'outcomes' ? null : 'outcomes')}
          className="w-full flex items-center justify-between text-left"
        >
          <h4 className="text-sm font-medium text-gray-700">Performance by Outcome</h4>
          <div className={`transform transition-transform ${expandedSection === 'outcomes' ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'outcomes' && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Home Win</span>
              <span className={`text-sm font-medium ${getAccuracyColor(metrics.homeWinAccuracy)}`}>
                {(metrics.homeWinAccuracy * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Draw</span>
              <span className={`text-sm font-medium ${getAccuracyColor(metrics.drawAccuracy)}`}>
                {(metrics.drawAccuracy * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Away Win</span>
              <span className={`text-sm font-medium ${getAccuracyColor(metrics.awayWinAccuracy)}`}>
                {(metrics.awayWinAccuracy * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Performance Trend */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setExpandedSection(expandedSection === 'trends' ? null : 'trends')}
          className="w-full flex items-center justify-between text-left"
        >
          <h4 className="text-sm font-medium text-gray-700">Performance Trend</h4>
          <div className={`transform transition-transform ${expandedSection === 'trends' ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'trends' && trends.length > 0 && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={[0, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: any) => [`${(value * 100).toFixed(1)}%`, 'Accuracy']}
                  labelStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="p-4">
        <button
          onClick={() => setExpandedSection(expandedSection === 'alerts' ? null : 'alerts')}
          className="w-full flex items-center justify-between text-left"
        >
          <h4 className="text-sm font-medium text-gray-700">
            Alerts {alerts.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                {alerts.length}
              </span>
            )}
          </h4>
          <div className={`transform transition-transform ${expandedSection === 'alerts' ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expandedSection === 'alerts' && (
          <div className="mt-4 space-y-2">
            {alerts.length > 0 ? (
              alerts.map((alert) => {
                const AlertIcon = getAlertIcon(alert.alertType)
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${getAlertColor(alert.severity)}`}
                  >
                    <div className="flex items-start space-x-2">
                      <AlertIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs mt-1 opacity-75">
                          Current: {(alert.currentAccuracy * 100).toFixed(1)}% |
                          Baseline: {(alert.baselineAccuracy * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-4">
                <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No alerts at this time</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 text-center">
          Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
        </p>
      </div>
    </div>
  )
}