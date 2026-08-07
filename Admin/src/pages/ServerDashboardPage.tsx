import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import {
  Activity,
  AlertTriangle,
  Archive,
  Ban,
  Bot,
  Database,
  FolderGit2,
  Monitor,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Server,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { HealthOverviewCard } from '@/components/Monitoring/HealthOverviewCard'
import { ResourceTrendChart } from '@/components/Monitoring/ResourceTrendChart'
import { SelfHealingConsole } from '@/components/Monitoring/SelfHealingConsole'
import { HealthScoreWidget } from '@/components/Monitoring/HealthScoreWidget'
import { TopProcessesTable } from '@/components/Monitoring/TopProcessesTable'
import { ServiceStatusMatrix } from '@/components/Monitoring/ServiceStatusMatrix'
import { useToast } from '@/hooks/useToast'
import { useServerManagementSocket } from '@/hooks/useServerManagementSocket'
import {
  SERVER_DASHBOARD_POLLING_INTERVAL_MS,
  SERVER_DASHBOARD_SOCKET_REFRESH_INTERVAL_MS,
} from '@/services/api/apiConfig'
import {
  useCollectLightweightMonitoringMutation,
  useGetAlertsQuery,
  useGetMetricsQuery,
  useGetLatestMonitoringHealthQuery,
  useGetLatestPredictionQuery,
  useGetServerMetricsHistoryQuery,
  useGetMonitoringHealthScoresQuery,
  useGetMonitoringHistoryQuery,
  useGetMonitoringSpikesQuery,
  useGetLatestDiskCleanupSummaryQuery,
  useGetMonitoringStatusQuery,
  useGetFileScannerAlertsQuery,
  useGetFileScanResultsQuery,
  useGetQuarantinedFilesQuery,
  useGetScanResultsQuery,
  useGetServersQuery,
  useGetServerProjectsQuery,
  useSyncServerProjectsMutation,
  useManualActionMutation,
  useRunAgentMutation,
  useGetPredictionsQuery,
  useStartScanMutation,
  useAddFeedbackMutation,
  usePlanRemediationMutation,
  useExecuteRemediationMutation,
  useRunFileScannerSweepMutation,
  useRestoreQuarantinedFileMutation,
} from '@/services/api/endpoints/serverManagementApi'
import type { CpuMemLivePayload, FileCategory, Metric, Prediction, PredictiveIssue } from '@/types/serverManagement'
import type { MonitoringMetricHistory } from '@/types/serverManagement'
import { classNames, formatBytes, formatDate } from '@/utils/serverManagementFormat'

const categoryOptions: Array<{ label: string; value: '' | FileCategory }> = [
  { label: 'All Categories', value: '' },
  { label: 'Unused', value: 'unused' },
  { label: 'Large', value: 'large' },
  { label: 'Logs', value: 'logs' },
  { label: 'Temp', value: 'temp' },
  { label: 'Duplicate', value: 'duplicate' },
  { label: 'System', value: 'system' },
  { label: 'Config', value: 'config' },
  { label: 'Application', value: 'application' },
  { label: 'Crash', value: 'crash' },
  { label: 'Service', value: 'service' },
  { label: 'Other', value: 'other' },
]

const categoryTone: Record<FileCategory, string> = {
  unused: 'bg-amber-50 text-amber-700 ring-amber-200',
  large: 'bg-sky-50 text-sky-700 ring-sky-200',
  logs: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  temp: 'bg-rose-50 text-rose-700 ring-rose-200',
  duplicate: 'bg-violet-50 text-violet-700 ring-violet-200',
  system: 'bg-slate-50 text-slate-700 ring-slate-200',
  config: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  application: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  crash: 'bg-red-50 text-red-700 ring-red-200',
  service: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  other: 'bg-zinc-50 text-zinc-700 ring-zinc-200',
}

const severityTone = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
}

const THREAT_SCANNER_POLLING_INTERVAL_MS = 5000

type CpuHistoryRange = '30m' | '1h' | '4h' | '6h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom'

const cpuHistoryRangeOptions: Array<{ label: string; value: CpuHistoryRange }> = [
  { label: 'Last 30 minutes', value: '30m' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 4 hours', value: '4h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 12 hours', value: '12h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 48 hours', value: '48h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom range', value: 'custom' },
]

const toDateTimeLocalValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoOrUndefined = (value: string) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

interface AgentPreview {
  decisions?: Array<{
    fileId: string
    path: string
    recommendation: {
      action: string
      confidence: number
      reason: string
      decisionTrace: string[]
    }
  }>
  pendingReviewCount?: number
  execution?: {
    skippedReason?: string
  }
}

function latestMetric(metrics: Metric[]) {
  return metrics[0]
}

function latestDateValue(...values: Array<string | undefined>) {
  const latest = values
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((first, second) => second.getTime() - first.getTime())[0]

  return latest?.toISOString()
}

function useDebouncedValue<T>(value: T, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])

  return debouncedValue
}

function HealthOverviewSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-[var(--color-border)]"></div>
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-[var(--color-border)]"></div>
            <div className="h-3 w-40 rounded bg-[var(--color-border)]"></div>
          </div>
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 space-y-3">
              <div className="h-2.5 w-16 rounded bg-[var(--color-border)]"></div>
              <div className="h-5 w-20 rounded bg-[var(--color-border)]"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 h-72 flex flex-col justify-between">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-[var(--color-border)]"></div>
          <div className="h-3 w-20 rounded bg-[var(--color-border)]"></div>
        </div>
      </div>
      <div className="flex-grow mt-6 flex items-end gap-2 bg-[var(--color-surface-muted)] p-4 rounded-2xl">
        {[...Array(16)].map((_, i) => (
          <div key={i} className="flex-1 bg-[var(--color-border)]/60 rounded-t" style={{ height: `${15 + Math.random() * 70}%` }}></div>
        ))}
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse p-5 space-y-4 w-full">
      <div className="h-10 rounded-2xl bg-[var(--color-border)]"></div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-14 rounded-2xl bg-[var(--color-surface-muted)] border border-[var(--color-border)]/65"></div>
      ))}
    </div>
  )
}

function PredictSkeleton() {
  return (
    <div className="animate-pulse space-y-6 w-full">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-5 w-20 rounded-full bg-[var(--color-border)]"></div>
              <div className="h-4 w-24 rounded bg-[var(--color-border)]"></div>
            </div>
            <div className="h-6 w-48 rounded bg-[var(--color-border)]"></div>
            <div className="h-3 w-full rounded bg-[var(--color-border)]"></div>
            <div className="h-3 w-full rounded bg-[var(--color-border)]"></div>
            <div className="h-20 rounded-2xl bg-[var(--color-surface-muted)]"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ServerDashboardPage() {
  const { showToast } = useToast()
  const [selectedServerId, setSelectedServerId] = useState<string>()
  const [isRestartingService, setIsRestartingService] = useState<string | null>(null)
  const [liveMetric, setLiveMetric] = useState<CpuMemLivePayload | null>(null)
  const [liveStreamingEnabled, setLiveStreamingEnabled] = useState(true)
  const [cpuChartRange, setCpuChartRange] = useState<'live' | 'history'>('live')
  const [cpuHistoryRange, setCpuHistoryRange] = useState<CpuHistoryRange>('24h')
  const [cpuCustomStartTime, setCpuCustomStartTime] = useState(() => toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)))
  const [cpuCustomEndTime, setCpuCustomEndTime] = useState(() => toDateTimeLocalValue(new Date()))
  // Rolling 60-point (60 s) buffer fed by CPU_MEM_LIVE socket events.
  // collectedAt is pre-computed from timestamp so the chart can consume it directly.
  const [liveHistory, setLiveHistory] = useState<Array<CpuMemLivePayload & { collectedAt: string }>>([])
  const [category, setCategory] = useState<FileCategory | ''>('')
  const [search, setSearch] = useState('')
  const [olderThanDays, setOlderThanDays] = useState('')
  const [minSizeMb, setMinSizeMb] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const debouncedOlderThanDays = useDebouncedValue(olderThanDays)
  const debouncedMinSizeMb = useDebouncedValue(minSizeMb)
  const [sortKey, setSortKey] = useState<'category' | 'sizeMb' | 'lastAccessed' | 'fileName'>('category')
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [agentPreview, setAgentPreview] = useState<AgentPreview | null>(null)
  const [isLoadingAgentPreview, setIsLoadingAgentPreview] = useState(false)
  const lastAutoRefreshAtRef = useRef(0)

  const { data: servers = [], isLoading: isServersLoading, refetch: refetchServers } = useGetServersQuery(undefined, {
    refetchOnMountOrArgChange: true,
  })
  const {
    data: metrics = [],
    refetch: refetchMetrics,
    isLoading: isLoadingMetrics,
  } = useGetMetricsQuery(
    { serverId: selectedServerId, limit: 1 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: scanResults = [],
    isLoading: isLoadingScanResults,
    isFetching: isFetchingScanResults,
    refetch: refetchScanResults,
  } = useGetScanResultsQuery(
    {
      serverId: selectedServerId,
      category: category || undefined,
      search: debouncedSearch || undefined,
      minSizeMb: debouncedMinSizeMb || undefined,
      olderThanDays: debouncedOlderThanDays || undefined,
      markReviewed: false,
      latest: true,
      limit: 200,
    },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: threatScanResults = [],
    isFetching: isFetchingThreatScanResults,
    refetch: refetchThreatScanResults,
  } = useGetFileScanResultsQuery(
    {
      serverId: selectedServerId,
      timeRange: '24h',
      limit: 20,
    },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: THREAT_SCANNER_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: quarantinedFiles = [],
    refetch: refetchQuarantinedFiles,
    isFetching: isFetchingQuarantinedFiles,
  } = useGetQuarantinedFilesQuery(
    { serverId: selectedServerId, limit: 20 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: THREAT_SCANNER_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: fileScannerAlerts = [],
    refetch: refetchFileScannerAlerts,
  } = useGetFileScannerAlertsQuery(
    { serverId: selectedServerId, timeRange: '24h', limit: 10 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: THREAT_SCANNER_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: alerts = [],
    refetch: refetchAlerts,
    isLoading: isLoadingAlerts,
  } = useGetAlertsQuery(
    { serverId: selectedServerId, limit: 6 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )

  const {
    data: predictionHistory = [],
    refetch: refetchPredictions,
    isLoading: isLoadingPredictions,
  } = useGetPredictionsQuery(
    { serverId: selectedServerId, limit: 10 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: predictiveInsights,
    isLoading: isLoadingLatestPrediction,
    isFetching: isFetchingLatestPrediction,
    isError: isLatestPredictionError,
    refetch: refetchLatestPrediction,
  } = useGetLatestPredictionQuery(
    { serverId: selectedServerId ?? '' },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: monitoringHistory = [],
    refetch: refetchMonitoringHistory,
    isLoading: isLoadingMonitoringHistory,
    isFetching: isFetchingMonitoringHistory,
  } = useGetMonitoringHistoryQuery(
    { serverId: selectedServerId, limit: 50 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: historicalMetrics = [],
    isLoading: isLoadingHistoricalMetrics,
    isFetching: isFetchingHistoricalMetrics,
    refetch: refetchHistoricalMetrics,
  } = useGetServerMetricsHistoryQuery(
    {
      serverId: selectedServerId ?? '',
      range: cpuHistoryRange,
      startTime: cpuHistoryRange === 'custom' ? toIsoOrUndefined(cpuCustomStartTime) : undefined,
      endTime: cpuHistoryRange === 'custom' ? toIsoOrUndefined(cpuCustomEndTime) : undefined,
    },
    {
      skip:
        !selectedServerId ||
        isServersLoading ||
        (cpuHistoryRange === 'custom' && (!cpuCustomStartTime || !cpuCustomEndTime)),
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: monitoringStatus,
    refetch: refetchMonitoringStatus,
    isLoading: isLoadingMonitoringStatus,
    isFetching: isFetchingMonitoringStatus,
  } = useGetMonitoringStatusQuery(
    { serverId: selectedServerId },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: latestMonitoringHealth,
    refetch: refetchLatestMonitoringHealth,
    isLoading: isLoadingLatestMonitoringHealth,
    isFetching: isFetchingLatestMonitoringHealth,
  } = useGetLatestMonitoringHealthQuery(
    { serverId: selectedServerId ?? '' },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    refetch: refetchMonitoringHealthScores,
    isFetching: isFetchingMonitoringHealthScores,
    isLoading: isLoadingMonitoringHealthScores,
  } = useGetMonitoringHealthScoresQuery(
    { serverId: selectedServerId, limit: 50 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    refetch: refetchMonitoringSpikes,
    isFetching: isFetchingMonitoringSpikes,
    isLoading: isLoadingMonitoringSpikes,
  } = useGetMonitoringSpikesQuery(
    { serverId: selectedServerId, limit: 50 },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )
  const {
    data: latestDiskCleanupSummary,
    refetch: refetchLatestDiskCleanupSummary,
  } = useGetLatestDiskCleanupSummaryQuery(
    { serverId: selectedServerId ?? '' },
    {
      skip: !selectedServerId || isServersLoading,
      pollingInterval: SERVER_DASHBOARD_POLLING_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  )

  const {
    data: serverProjects = [],
    isLoading: isLoadingServerProjects,
    isFetching: isFetchingServerProjects,
  } = useGetServerProjectsQuery(selectedServerId ?? '', {
    skip: !selectedServerId || isServersLoading,
    refetchOnMountOrArgChange: true,
  })
  const [syncServerProjects, { isLoading: isSyncingServerProjects }] = useSyncServerProjectsMutation()

  const [collectLightweightMonitoring, { isLoading: isCollectingLightweightMonitoring }] =
    useCollectLightweightMonitoringMutation()
  const [startScan, { isLoading: isScanning }] = useStartScanMutation()
  const [runFileScannerSweep, { isLoading: isRunningThreatSweep }] = useRunFileScannerSweepMutation()
  const [restoreQuarantinedFile, { isLoading: isRestoringQuarantinedFile }] = useRestoreQuarantinedFileMutation()
  const [manualAction, { isLoading: isActing }] = useManualActionMutation()
  const [runAgent] = useRunAgentMutation()
  const [, { isLoading: isAddingFeedback }] = useAddFeedbackMutation()
  const [planRemediation, { isLoading: isPlanningRemediation }] = usePlanRemediationMutation()
  const [executeRemediation, { isLoading: isExecutingRemediation }] = useExecuteRemediationMutation()

  const serverOptions = useMemo(() => {
    return servers.map((server) => ({
      label: `${server.name} (${server.host})`,
      value: server._id,
    }))
  }, [servers])

  const isServerDataLoading =
    !!selectedServerId &&
    (isLoadingMetrics ||
      isLoadingScanResults ||
      isLoadingAlerts ||
      isLoadingPredictions ||
      isLoadingLatestPrediction ||
      isLoadingMonitoringHistory ||
      isLoadingHistoricalMetrics ||
      isLoadingLatestMonitoringHealth ||
      isLoadingMonitoringHealthScores ||
      isLoadingMonitoringSpikes ||
      isLoadingMonitoringStatus)

  const isBlockingLoading =
    isScanning ||
    isActing ||
    isLoadingAgentPreview ||
    isPlanningRemediation ||
    isExecutingRemediation ||
    isAddingFeedback ||
    isCollectingLightweightMonitoring

  const handleRemediate = async (prediction: Prediction, issue: PredictiveIssue) => {
    if (!selectedServerId) return

    const issueText = issue.issue || ''
    const recommendationText = issue.recommendation || ''
    const predictedFailureText = issue.predictedFailure || ''

    try {
      const plannedJob = await planRemediation({
        serverId: selectedServerId,
        intent: issueText,
        context: {
          issue: issueText,
          predictedFailure: predictedFailureText,
          recommendation: recommendationText,
          severity: issue.severity,
          confidence: issue.confidence,
          horizonMinutes: issue.horizonMinutes,
          evidence: issue.evidence,
          recommendedActions: issue.recommendedActions,
          serviceName:
            issueText.match(/service (\S+)/i)?.[1] ||
            recommendationText.match(/service (\S+)/i)?.[1],
          pid:
            issueText.match(/pid (\d+)/i)?.[1] ||
            predictedFailureText.match(/pid (\d+)/i)?.[1],
          path:
            recommendationText.match(/(\/[A-Za-z0-9_./-]+)/)?.[1] ||
            predictedFailureText.match(/(\/[A-Za-z0-9_./-]+)/)?.[1],
        },
        description: `Automated fix for: ${issueText}. Predicted failure: ${predictedFailureText || 'unknown'}`,
        predictionId: prediction._id,
        approvalMode: 'auto',
      }).unwrap()

      const executedJob = await executeRemediation(plannedJob._id).unwrap()
      showToast({
        severity: 'success',
        summary: 'AI remediation started',
        detail:
          executedJob.status === 'completed'
            ? 'The AI-planned remediation completed successfully.'
            : `Remediation job is now ${executedJob.status}. Execution will continue in the background.`,
      })
      refreshLiveData()
    } catch (err) {
      const detail =
        (err as { data?: { message?: string } })?.data?.message ||
        (err as { message?: string })?.message ||
        'The remediation request could not be completed.'
      showToast({ severity: 'error', summary: 'Failed to run AI remediation', detail })
    }
  }

  useEffect(() => {
    if (!selectedServerId && servers[0]?._id) {
      setSelectedServerId(servers[0]._id)
    }
  }, [selectedServerId, servers])

  // Reset live state when switching servers so stale values don't flash
  useEffect(() => {
    setLiveMetric(null)
    setLiveHistory([])
  }, [selectedServerId])

  useEffect(() => {
    if (!liveStreamingEnabled) {
      setLiveMetric(null)
      setLiveHistory([])
    }
  }, [liveStreamingEnabled])

  const refreshLiveData = useCallback(() => {
    void refetchServers()
    void refetchMetrics()
    void refetchScanResults()
    void refetchAlerts()
    void refetchPredictions()
    void refetchLatestPrediction()
    void refetchMonitoringStatus()
    void refetchMonitoringHistory()
    void refetchHistoricalMetrics()
    void refetchLatestMonitoringHealth()
    void refetchMonitoringHealthScores()
    void refetchMonitoringSpikes()
    void refetchLatestDiskCleanupSummary()
  }, [
    refetchServers,
    refetchAlerts,
    refetchLatestMonitoringHealth,
    refetchLatestPrediction,
    refetchMetrics,
    refetchMonitoringStatus,
    refetchHistoricalMetrics,
    refetchMonitoringHealthScores,
    refetchMonitoringHistory,
    refetchMonitoringSpikes,
    refetchLatestDiskCleanupSummary,
    refetchPredictions,
    refetchScanResults,
  ])

  useEffect(() => {
    if (selectedServerId) {
      refreshLiveData()
    }
  }, [selectedServerId, refreshLiveData])

  const refreshLiveDataThrottled = useCallback(() => {
    const now = Date.now()
    if (now - lastAutoRefreshAtRef.current < SERVER_DASHBOARD_SOCKET_REFRESH_INTERVAL_MS) {
      return
    }

    lastAutoRefreshAtRef.current = now
    refreshLiveData()
  }, [refreshLiveData])

  const handleLiveCpuMem = useCallback((data: CpuMemLivePayload) => {
    setLiveMetric(data)
    setLiveHistory((prev) => {
      const point = { ...data, collectedAt: new Date(data.timestamp).toISOString() }
      const next = [...prev, point]
      return next.length > 60 ? next.slice(next.length - 60) : next
    })
  }, [])

  useServerManagementSocket(selectedServerId, refreshLiveDataThrottled, {
    onLiveCpuMem: handleLiveCpuMem,
    liveMetricsEnabled: liveStreamingEnabled,
  })

  const isPageLoading = isBlockingLoading

  const currentMetric = latestMetric(metrics)
  const cpuTrendMetrics = monitoringHistory
  const latestMonitoringMetric = cpuTrendMetrics[0]
  const historicalChartMetrics = useMemo(
    () => [...historicalMetrics].reverse(),
    [historicalMetrics],
  )
  const liveChartMetrics = useMemo(() => {
    const latestHistoricalAt = historicalMetrics.length
      ? Math.max(
        ...historicalMetrics
          .map((metric: MonitoringMetricHistory) => new Date(metric.collectedAt).getTime())
          .filter((timestamp: number) => Number.isFinite(timestamp)),
      )
      : 0

    return liveHistory
      .filter((point) => point.timestamp > latestHistoricalAt)
      .map((point) => ({
        ...point,
        _id: `live-${point.timestamp}`,
        server: selectedServerId ?? '',
        diskUsagePercent: latestMonitoringMetric?.diskUsagePercent ?? 0,
        diskReadBytesPerSecond: latestMonitoringMetric?.diskReadBytesPerSecond ?? 0,
        diskWriteBytesPerSecond: latestMonitoringMetric?.diskWriteBytesPerSecond ?? 0,
        filesystemGrowthBytesPerMinute: latestMonitoringMetric?.filesystemGrowthBytesPerMinute ?? 0,
        networkRxBytesPerSecond: latestMonitoringMetric?.networkRxBytesPerSecond ?? 0,
        networkTxBytesPerSecond: latestMonitoringMetric?.networkTxBytesPerSecond ?? 0,
        serviceSummary: latestMonitoringMetric?.serviceSummary ?? {
          running: 0,
          failed: 0,
          inactive: 0,
          failedServices: [],
        },
        processSummary: latestMonitoringMetric?.processSummary ?? {
          total: 0,
          zombies: 0,
          blocked: 0,
          topCpu: [],
        },
        sshSessionActivity: latestMonitoringMetric?.sshSessionActivity ?? {
          loggedInUsers: 0,
          establishedSessions: 0,
          recentAuthWarnings: 0,
        },
        filesystems: latestMonitoringMetric?.filesystems ?? [],
        pollIntervalMs: 1000,
      }))
      .reverse()
  }, [historicalMetrics, latestMonitoringMetric, liveHistory, selectedServerId])
  const cpuChartMetrics =
    liveChartMetrics.length || historicalChartMetrics.length
      ? [...liveChartMetrics, ...historicalChartMetrics]
      : cpuTrendMetrics
  const hasNoHistoricalMetrics = Boolean(selectedServerId) && !isFetchingHistoricalMetrics && historicalMetrics.length === 0
  const isMonitoringLoading =
    isLoadingMonitoringStatus ||
    isLoadingMonitoringHistory ||
    isLoadingHistoricalMetrics ||
    isLoadingLatestMonitoringHealth ||
    isFetchingMonitoringStatus ||
    isFetchingMonitoringHistory ||
    (isFetchingHistoricalMetrics && !historicalChartMetrics.length) ||
    isFetchingLatestMonitoringHealth ||
    isFetchingMonitoringHealthScores ||
    isFetchingMonitoringSpikes

  const sortedResults = useMemo(() => {
    return [...scanResults].sort((first, second) => {
      if (sortKey === 'sizeMb') {
        return second.sizeMb - first.sizeMb
      }
      if (sortKey === 'lastAccessed') {
        return new Date(first.lastAccessed).getTime() - new Date(second.lastAccessed).getTime()
      }
      if (sortKey === 'fileName') {
        return first.fileName.localeCompare(second.fileName)
      }
      const order: FileCategory[] = ['duplicate', 'crash', 'large', 'logs', 'temp', 'unused', 'service', 'config', 'application', 'system', 'other']
      return order.indexOf(first.category) - order.indexOf(second.category)
    })
  }, [scanResults, sortKey])

  const groupedCounts = useMemo(
    () =>
      sortedResults.reduce<Record<string, number>>((acc, result) => {
        acc[result.category] = (acc[result.category] ?? 0) + 1
        return acc
      }, {}),
    [sortedResults],
  )

  const toggleSelected = (fileId: string) => {
    setSelectedFileIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
    )
  }

  const selectedServer = servers.find((server) => server._id === selectedServerId)

  const lastMetricsTime = latestMonitoringMetric?.collectedAt || currentMetric?.collectedAt || selectedServer?.lastMetricsAt
  const lastScanTime = latestDateValue(
    scanResults[0]?.discoveredAt,
    selectedServer?.lastScanAt,
    latestDiskCleanupSummary?.cleanupStartedAt,
    latestDiskCleanupSummary?.createdAt,
  )

  const handleCollectMetrics = async () => {
    if (!selectedServerId) {
      return
    }

    refreshLiveData()
    showToast({ severity: 'success', summary: 'Cached dashboard data refreshed' })
  }

  const handleCollectLightweightMonitoring = async () => {
    if (!selectedServerId) {
      return
    }

    await collectLightweightMonitoring({ serverId: selectedServerId }).unwrap()
    refreshLiveData()
    showToast({ severity: 'success', summary: 'Lightweight monitoring sample collected' })
  }

  const handleRestartService = async (serviceName: string) => {
    if (!selectedServerId) return
    setIsRestartingService(serviceName)
    try {
      showToast({
        severity: 'info',
        summary: 'Initiating recovery action',
        detail: `Planning self-healing task: "Restart service ${serviceName}"`,
      })
      const planned = await planRemediation({
        serverId: selectedServerId,
        intent: `Restart systemd service ${serviceName}`,
        description: `Operator triggered restart for "${serviceName}" daemon.`,
        approvalMode: 'auto',
      }).unwrap()
      await executeRemediation(planned._id).unwrap()
      showToast({
        severity: 'success',
        summary: 'Recovery action completed',
        detail: `Self-healing command executed successfully.`,
      })
      handleCollectLightweightMonitoring()
    } catch (err: any) {
      const detail = err?.data?.message || err?.message || 'Failed to complete recovery command.'
      showToast({
        severity: 'error',
        summary: 'Recovery execution failed',
        detail,
      })
    } finally {
      setIsRestartingService(null)
    }
  }

  const handleStartScan = async () => {
    if (!selectedServerId) {
      return
    }

    const result = await startScan({ serverId: selectedServerId }).unwrap()
    setSelectedFileIds([])
    showToast({
      severity: 'info',
      summary: 'Scan completed',
      detail: `${result.fileCount} files scanned; ${result.analysis?.analyzedCount ?? 0} AI analyses completed.`,
    })
  }

  const handleSyncProjects = async () => {
    if (!selectedServerId) {
      return
    }

    try {
      const projects = await syncServerProjects(selectedServerId).unwrap()
      showToast({
        severity: 'success',
        summary: 'Project discovery synced',
        detail: `${projects.length} project${projects.length === 1 ? '' : 's'} mapped to this server.`,
      })
    } catch (err) {
      const detail =
        (err as { data?: { message?: string } })?.data?.message ||
        (err as { message?: string })?.message ||
        'Project discovery could not be completed.'
      showToast({ severity: 'error', summary: 'Failed to sync projects', detail })
    }
  }

  const handleThreatScannerSweep = async () => {
    if (!selectedServerId) {
      return
    }

    await runFileScannerSweep(selectedServerId).unwrap()
    await refetchThreatScanResults()
    await refetchQuarantinedFiles()
    await refetchFileScannerAlerts()
    showToast({ severity: 'success', summary: 'Server-wide file detection refreshed' })
  }

  const handleRestoreQuarantinedFile = async (scanResultId: string) => {
    await restoreQuarantinedFile(scanResultId).unwrap()
    await refetchThreatScanResults()
    await refetchQuarantinedFiles()
    showToast({ severity: 'success', summary: 'File restored from compressed backup' })
  }

  const handleManualAction = async (action: 'delete' | 'archive' | 'ignore') => {
    if (!selectedServerId || !selectedFileIds.length) {
      return
    }

    await manualAction({
      serverId: selectedServerId,
      fileIds: selectedFileIds,
      action,
      reason: `Manual ${action} from dashboard selection.`,
    }).unwrap()
    setSelectedFileIds([])
    showToast({ severity: 'success', summary: `Manual ${action} completed` })
  }

  const handleRunAgent = async (execute: boolean) => {
    if (!selectedServerId) {
      return
    }

    setIsLoadingAgentPreview(true)
    try {
      const result = await runAgent({ serverId: selectedServerId, execute }).unwrap()
      setAgentPreview(result)
      showToast({
        severity: execute ? 'success' : 'info',
        summary: execute ? 'Automation run finished' : 'AI preview ready',
      })
    } catch (err) {
      showToast({
        severity: 'error',
        summary: 'AI agent execution failed',
      })
    } finally {
      setIsLoadingAgentPreview(false)
    }
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          badge: "bg-rose-100 text-rose-300 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
          border: "border-rose-300 dark:border-rose-500/40",
          text: "text-rose-700 dark:text-rose-300",
          bg: "bg-rose-50 dark:bg-rose-500/10",
          buttonBg: "bg-rose-600 dark:bg-rose-500",
          buttonText: "text-white dark:text-rose-50",
          buttonHover: "hover:bg-rose-700 dark:hover:bg-rose-400",
          softBg: "bg-rose-500/5 dark:bg-rose-500/10",
          softRing: "ring-rose-500/20 dark:ring-rose-500/30",
        };

      case 'high':
        return {
          badge: "bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
          border: "border-amber-300 dark:border-amber-500/40",
          text: "text-amber-700 dark:text-amber-300",
          bg: "bg-amber-50 dark:bg-amber-500/10",
          buttonBg: "bg-amber-600 dark:bg-amber-500",
          buttonText: "text-white dark:text-amber-50",
          buttonHover: "hover:bg-amber-700 dark:hover:bg-amber-400",
          softBg: "bg-amber-500/5 dark:bg-amber-500/10",
          softRing: "ring-amber-500/20 dark:ring-amber-500/30",
        };

      default:
        return {
          badge: "bg-blue-100 text-blue-700 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
          border: "border-blue-300 dark:border-blue-500/40",
          text: "text-blue-700 dark:text-blue-300",
          bg: "bg-blue-50 dark:bg-blue-500/10",
          buttonBg: "bg-blue-600 dark:bg-blue-500",
          buttonText: "text-white dark:text-blue-50",
          buttonHover: "hover:bg-blue-700 dark:hover:bg-blue-400",
          softBg: "bg-blue-500/5 dark:bg-blue-500/10",
          softRing: "ring-blue-500/20 dark:ring-blue-500/30",
        };
    }
  };

  const cpuChartControls = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={liveStreamingEnabled}
        onClick={() => {
          setLiveStreamingEnabled((enabled) => !enabled)
          setCpuChartRange('live')
        }}
        className={classNames(
          'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-bold transition',
          liveStreamingEnabled
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]',
        )}
        disabled={!selectedServerId}
        title={liveStreamingEnabled ? 'Disable live streaming graph' : 'Enable live streaming graph'}
      >
        <span
          className={classNames(
            'relative h-4 w-8 rounded-full transition',
            liveStreamingEnabled ? 'bg-emerald-500' : 'bg-[var(--color-border)]',
          )}
        >
          <span
            className={classNames(
              'absolute top-0.5 h-3 w-3 rounded-full bg-white transition',
              liveStreamingEnabled ? 'left-4' : 'left-0.5',
            )}
          />
        </span>
        Live streaming
      </button>
      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
        <button
          type="button"
          className={classNames(
            'h-7 rounded-md px-2 text-xs font-semibold',
            cpuChartRange === 'live'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]',
          )}
          onClick={() => setCpuChartRange('live')}
        >
          Live
        </button>
        <button
          type="button"
          className={classNames(
            'h-7 rounded-md px-2 text-xs font-semibold',
            cpuChartRange === 'history'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]',
          )}
          onClick={() => setCpuChartRange('history')}
          disabled={!selectedServerId}
        >
          History
        </button>
      </div>
      {cpuChartRange === 'history' && (
        <>
          <Dropdown
            value={cpuHistoryRange}
            options={cpuHistoryRangeOptions}
            optionLabel="label"
            optionValue="value"
            onChange={(event) => {
              setCpuHistoryRange(event.value)
              setCpuChartRange('history')
            }}
            className="h-8 min-w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-semibold"
            disabled={!selectedServerId}
          />
          {cpuHistoryRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                <span>From</span>
                <input
                  type="datetime-local"
                  value={cpuCustomStartTime}
                  onChange={(event) => setCpuCustomStartTime(event.target.value)}
                  className="h-8 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none"
                  disabled={!selectedServerId}
                />
              </label>
              <label className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                <span>To</span>
                <input
                  type="datetime-local"
                  value={cpuCustomEndTime}
                  onChange={(event) => setCpuCustomEndTime(event.target.value)}
                  className="h-8 w-44 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-semibold text-[var(--color-text-strong)] outline-none"
                  disabled={!selectedServerId}
                />
              </label>
            </div>
          )}
        </>
      )}
      {isFetchingHistoricalMetrics && (
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
          Loading history
        </span>
      )}
    </div>
  )

  return (
    <>
      {isPageLoading && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <LoadingScreen className="bg-[var(--color-page)]/60 backdrop-blur-sm" message="Loading server data..." />
        </div>
      )}
      <div className="mx-auto max-w-full space-y-5">
        <PageHeader
          eyebrow="AI Server Management"
          title="Server operations dashboard"
          description="Live metrics, scan findings, review controls, and explainable maintenance decisions."
        />

        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-5 md:grid-cols-[minmax(250px,360px)_1fr]">
            <label className="flex flex-col space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Server</span>
              <Dropdown
                className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm flex items-center transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
                value={selectedServerId ?? ''}
                onChange={(e) => setSelectedServerId(e.value || undefined)}
                options={serverOptions}
                optionLabel="label"
                optionValue="value"
                placeholder="Select a Server"
                loading={isServersLoading}
              />
            </label>
            <div className="grid grid-cols-1 gap-4 text-left text-sm sm:grid-cols-3 md:pb-1 items-end">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</span>
                <span className="text-base sm:text-lg font-semibold text-[var(--color-text-strong)] mt-1 truncate">
                  {isServerDataLoading ? (
                    <span className="inline-block h-5 w-16 animate-pulse rounded bg-[var(--color-border)] mt-1"></span>
                  ) : (
                    selectedServer?.status ?? 'No server'
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Last metrics</span>
                <span className="text-base sm:text-lg font-semibold text-[var(--color-text-strong)] mt-1 truncate">
                  {isServerDataLoading ? (
                    <span className="inline-block h-5 w-24 animate-pulse rounded bg-[var(--color-border)] mt-1"></span>
                  ) : (
                    formatDate(lastMetricsTime)
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Last scan</span>
                <span className="text-base sm:text-lg font-semibold text-[var(--color-text-strong)] mt-1 truncate">
                  {isServerDataLoading ? (
                    <span className="inline-block h-5 w-24 animate-pulse rounded bg-[var(--color-border)] mt-1"></span>
                  ) : (
                    formatDate(lastScanTime)
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 lg:mt-0">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-hover)]"
              onClick={() => {
                void handleCollectMetrics()
                void handleCollectLightweightMonitoring()
              }}
              disabled={!selectedServerId}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
              onClick={handleStartScan}
              disabled={!selectedServerId || isScanning}
            >
              <Play className="h-4 w-4" />
              Scan
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          {/* <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-[var(--color-text-strong)]">Live Monitoring Foundation</h2>
                <span
                  className={classNames(
                    'rounded-full px-2 py-1 text-xs font-bold ring-1',
                    monitoringBadge.className,
                  )}
                >
                  {monitoringBadge.label}
                </span>
                {isMonitoringLoading && (
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
                    Refreshing live samples
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Health scores, resource history, service status, and spike alerts from lightweight OS collectors.
                {monitoringStatus?.pollingInterval
                  ? ` Polling every ${Math.round(monitoringStatus.pollingInterval / 1000)}s.`
                  : ''}
                {monitoringStatus?.lastSampleAt ? ` Last sample ${formatDate(monitoringStatus.lastSampleAt)}.` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-200">
                  Core monitoring {monitoringStatus?.coreMonitoringEnabled ? 'enabled' : 'disabled'}
                </span>
                <span
                  className={classNames(
                    'rounded-full px-2 py-1 ring-1',
                    monitoringStatus?.deepScanEnabled
                      ? 'bg-amber-50 text-amber-700 ring-amber-200'
                      : 'bg-slate-50 text-slate-700 ring-slate-200',
                  )}
                >
                  Deep scan {monitoringStatus?.deepScanEnabled ? 'enabled' : 'disabled'}
                </span>
                <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
                  Last collector {monitoringStatus?.impact?.lastCollectorDurationMs ?? 0}ms
                </span>
                <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
                  {monitoringStatus?.impact?.commandsExecutedLastMinute ?? 0} commands/min
                </span>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCollectLightweightMonitoring}
              disabled={!selectedServerId || isCollectingLightweightMonitoring}
            >
              <RefreshCw className={classNames('h-4 w-4', isCollectingLightweightMonitoring ? 'animate-spin' : '')} />
              Collect sample
            </button>
          </div> */}
          <HealthScoreWidget healthScore={latestMonitoringHealth ?? undefined} />

          {!selectedServerId ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
              Select a server to load monitoring samples.
            </div>
          ) : isServerDataLoading ? (
            <div className="space-y-4">
              <HealthOverviewSkeleton />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <ChartSkeleton />
                <div className="animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 h-72"></div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                <div className="animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 h-[300px]"></div>
                <div className="animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 h-[300px]"></div>
              </div>
            </div>
          ) : !latestMonitoringMetric && !isMonitoringLoading ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
              No lightweight monitoring samples yet. Start background monitoring or collect a sample manually.
            </div>
          ) : (
            <div className="space-y-4">
              <HealthOverviewCard
                metric={
                  latestMonitoringMetric && liveMetric
                    ? {
                      ...latestMonitoringMetric,
                      cpuUsagePercent: liveMetric.cpuUsagePercent,
                      memoryUsagePercent: liveMetric.memoryUsagePercent,
                      swapUsagePercent: liveMetric.swapUsagePercent,
                      loadAverage: liveMetric.loadAverage,
                      memoryCachedBytes: liveMetric.memoryCachedBytes,
                      networkRxBytesPerSecond: liveMetric.networkRxBytesPerSecond ?? latestMonitoringMetric.networkRxBytesPerSecond,
                      networkTxBytesPerSecond: liveMetric.networkTxBytesPerSecond ?? latestMonitoringMetric.networkTxBytesPerSecond,
                      processSummary: {
                        ...latestMonitoringMetric.processSummary,
                        total: liveMetric.processesTotal ?? latestMonitoringMetric.processSummary.total,
                      },
                    }
                    : latestMonitoringMetric
                }
                metrics={cpuTrendMetrics}
                healthScore={latestMonitoringHealth ?? undefined}
                isLive={liveMetric !== null}
              />
              {latestDiskCleanupSummary ? (
                <section className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Last cleanup</p>
                    <p className="mt-1 text-sm font-black text-[var(--color-text-strong)]">{formatDate(latestDiskCleanupSummary.cleanupCompletedAt || latestDiskCleanupSummary.createdAt || '')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Status</p>
                    <p className="mt-1 text-sm font-black text-[var(--color-text-strong)]">{latestDiskCleanupSummary.status}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Storage reduced</p>
                    <p className="mt-1 text-sm font-black text-[var(--color-text-strong)]">{latestDiskCleanupSummary.storageReducedGB} GB</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Before</p>
                    <p className="mt-1 text-sm font-black text-[var(--color-text-strong)]">{latestDiskCleanupSummary.diskUsagePercentBefore}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">After</p>
                    <p className="mt-1 text-sm font-black text-[var(--color-text-strong)]">{latestDiskCleanupSummary.diskUsagePercentAfter}%</p>
                  </div>
                </section>
              ) : null}
              <div className="grid gap-3">
                {hasNoHistoricalMetrics && !liveChartMetrics.length ? (
                  <article className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-strong)]">
                          No historical data available
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          Metrics will appear here after the background collector writes samples for this server.
                        </p>
                      </div>
                      {cpuChartControls}
                    </div>
                  </article>
                ) : cpuChartRange === 'live' && !liveStreamingEnabled ? (
                  <article className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-strong)]">
                          CPU live stream paused
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          Enable live streaming to start the 1-second CPU
                          graph.
                        </p>
                      </div>
                      {cpuChartControls}
                    </div>

                    {/* <ServiceStatusMatrix metric={latestMonitoringMetric} /> */}
                  </article>
                ) : (
                  <ResourceTrendChart
                    metrics={cpuChartMetrics}
                    resourceKey="cpuUsagePercent"
                    showSeconds={cpuChartRange === 'live'}
                    yDomain={[0, 100]}
                    isLive={cpuChartRange === 'live' && liveHistory.length > 0}
                    showDiagnostics={cpuChartRange === 'history'}
                    footerNote={
                      cpuChartRange === 'history'
                        ? 'Spike reasons are based on sampled system diagnostics and may be approximate.'
                        : undefined
                    }
                    rightAccessory={cpuChartControls}
                  />
                )}
                {/* <ServiceStatusMatrix metric={latestMonitoringMetric} /> */}
              </div>
              <TopProcessesTable processes={latestMonitoringMetric?.processSummary?.topCpu ?? []} />
              {/* <div className="grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"> */}
                {/* <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Spike alerts</h3>
                    <span className="text-xs text-[var(--color-text-muted)]">{monitoringSpikes.length} recent</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {monitoringSpikes.length ? (
                      monitoringSpikes.slice(0, 6).map((spike) => (
                        <div
                          key={spike._id}
                          className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold capitalize">{spike.metric.replace(/_/g, ' ')}</p>
                              <p className="text-xs">{spike.message}</p>
                              <p className="mt-1 text-[11px] opacity-80">{formatDate(spike.detectedAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
                        No recent resource spikes detected.
                      </div>
                    )}
                  </div>
                </article> */}
                {/* <InfrastructureTimeline
                  metrics={monitoringHistory}
                  healthScores={monitoringHealthScores}
                  spikes={monitoringSpikes}
                /> */}
              {/* </div> */}

              <ServiceStatusMatrix
                metric={latestMonitoringMetric ?? undefined}
                status={monitoringStatus ?? undefined}
                isRestartingService={isRestartingService}
                onRestartService={handleRestartService}
              />
              <SelfHealingConsole
                status={monitoringStatus ?? undefined}
                serverId={selectedServerId ?? ""}
                onPlanRemediation={planRemediation}
                onExecuteRemediation={executeRemediation}
                onCollectSample={handleCollectLightweightMonitoring}
                isCollecting={isCollectingLightweightMonitoring}
                showToast={showToast}
              />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-col gap-4 pt-5 pl-5 pr-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <FolderGit2 className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-[var(--color-text-strong)]">Server projects</h2>
                  {selectedServerId && serverProjects.length > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-primary)]/10 px-1.5 text-xs font-bold text-[var(--color-primary)]">
                      {serverProjects.length}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Projects discovered on this server, with their port and database.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text-strong)] transition hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSyncProjects}
              disabled={!selectedServerId || isSyncingServerProjects}
            >
              <RefreshCw className={classNames('h-4 w-4', isSyncingServerProjects ? 'animate-spin' : '')} />
              {isSyncingServerProjects ? 'Syncing…' : 'Sync'}
            </button>
          </div>

          <div className="p-5">
            {!selectedServerId ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                  <Server className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">No server selected</p>
                <p className="max-w-xs text-sm text-[var(--color-text-muted)]">
                  Select a server above to view the projects it's hosting.
                </p>
              </div>
            ) : isLoadingServerProjects || (isFetchingServerProjects && !serverProjects.length) ? (
              <TableSkeleton />
            ) : serverProjects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                  <FolderGit2 className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">No projects available</p>
                <p className="max-w-xs text-sm text-[var(--color-text-muted)]">
                  Run a sync to discover the projects hosted on this server.
                </p>
                <button
                  type="button"
                  className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSyncProjects}
                  disabled={isSyncingServerProjects}
                >
                  <RefreshCw className={classNames('h-4 w-4', isSyncingServerProjects ? 'animate-spin' : '')} />
                  {isSyncingServerProjects ? 'Syncing…' : 'Sync now'}
                </button>
              </div>
            ) : (
              <div className="max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] overflow-auto rounded-2xl border border-[var(--color-border)]">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Port</th>
                      <th className="px-4 py-3">Project path</th>
                      <th className="px-4 py-3">Database</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Config</th>
                      <th className="px-4 py-3">Nginx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {serverProjects.map((project) => (
                      <tr key={project._id} className="group transition-colors hover:bg-[var(--color-hover)]">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary)]">
                              <Monitor className="h-4 w-4" />
                            </span>
                            <span className="font-semibold text-[var(--color-text-strong)]">{project.projectName}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {project.portNumber ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 font-mono text-xs font-semibold text-[var(--color-text-strong)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              :{project.portNumber}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">—</span>
                          )}
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs" title={project.projectPath || ''}>
                          {project.projectPath || <span className="text-[var(--color-text-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {project.databaseName ? (
                            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 font-mono text-xs text-[var(--color-text-strong)]">
                              <Database className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                              {project.databaseName}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                            {project.discoveryStatus || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs" title={project.configFile || ''}>
                          {project.configFile || <span className="text-[var(--color-text-muted)]">—</span>}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs" title={project.nginxFile || ''}>
                          {project.nginxFile || <span className="text-[var(--color-text-muted)]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-1">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-strong)]">Latest server-wide file detections</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Automatic protection runs in the background every few seconds. Check now is only for manual testing.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-hover)] disabled:opacity-60"
                onClick={handleThreatScannerSweep}
                disabled={!selectedServerId || isRunningThreatSweep}
              >
                <RefreshCw className={classNames('h-4 w-4', isRunningThreatSweep ? 'animate-spin' : '')} />
                {isRunningThreatSweep ? 'Checking' : 'Check now'}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Backup first</p>
                <p className="mt-1 text-sm text-[var(--color-text-strong)]">High risk files are compressed into backup storage automatically before containment.</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Containment status</p>
                <p className="mt-1 text-sm text-[var(--color-text-strong)]">`delete_completed` means the harmful file was removed from its original path after backup.</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Audit record</p>
                <p className="mt-1 text-sm text-[var(--color-text-strong)]">The DB stores metadata, risk, backup path, and action status only; it does not store full file content.</p>
              </div>
            </div>

            <div className="mt-4 max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Backup</th>
                    <th className="px-4 py-3">Quarantine</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Detected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {threatScanResults.map((item) => (
                    <tr key={item._id} className="hover:bg-[var(--color-hover)]">
                      <td className="max-w-[420px] px-4 py-3">
                        <div className="max-w-[500px] overflow-hidden">
                          <p className="truncate font-semibold text-[var(--color-text-strong)]" title={item.fileName}>
                            {item.fileName}
                          </p>
                          <p className="truncate text-xs text-[var(--color-text-muted)]" title={item.filePath}>{item.filePath}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold uppercase text-[var(--color-text-muted)]">{item.fileCategory || 'unknown'}</td>
                      <td className="px-4 py-3">
                        <span className={classNames(
                          'rounded-full px-2 py-1 text-xs font-semibold ring-1',
                          item.riskLevel === 'high' || item.riskLevel === 'critical'
                            ? 'bg-rose-50 text-rose-700 ring-rose-200'
                            : item.riskLevel === 'medium'
                              ? 'bg-amber-50 text-amber-700 ring-amber-200'
                              : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                        )}>
                          {item.riskLevel}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <div className="max-w-[260px] overflow-hidden">
                          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{item.backupStatus || 'none'}</p>
                          <p className="truncate text-xs text-[var(--color-text-muted)]" title={item.compressedBackupPath || item.backupPath}>
                            {item.compressedBackupPath || item.backupPath || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <div className="max-w-[260px] overflow-hidden">
                          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{item.quarantineStatus || 'none'}</p>
                          <p className="truncate text-xs text-[var(--color-text-muted)]" title={item.quarantinePath}>
                            {item.quarantinePath || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <div className="max-w-[260px] overflow-hidden">
                          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{item.actionStatus || item.scanStatus}</p>
                          {item.actionError ? (
                            <p className="mt-1 line-clamp-2 text-xs text-rose-600" title={item.actionError}>{item.actionError}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                  {!threatScanResults.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                        {isFetchingThreatScanResults ? 'Loading server-wide file detections...' : 'No server-wide file detections yet. Click Check now after creating a test file.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)]">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Quarantined files and backups</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Restore copies the compressed backup back to the original path.</p>
                  </div>
                  {isFetchingQuarantinedFiles ? <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-text-muted)]" /> : null}
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {quarantinedFiles.slice(0, 6).map((item) => (
                    <div key={item._id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--color-text-strong)]" title={item.originalPath}>{item.originalPath}</p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]" title={item.backupPath}>Backup: {item.backupPath}</p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]" title={item.quarantinePath}>Quarantine: {item.quarantinePath}</p>
                        <p className="mt-1 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Status: {item.status}</p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-hover)] disabled:opacity-60"
                        onClick={() => handleRestoreQuarantinedFile(item.scanResult)}
                        disabled={isRestoringQuarantinedFile || item.status !== 'quarantined'}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </button>
                    </div>
                  ))}
                  {!quarantinedFiles.length ? (
                    <div className="p-4 text-sm text-[var(--color-text-muted)]">No quarantined files for the selected server.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)]">
                <div className="border-b border-[var(--color-border)] px-4 py-3">
                  <h3 className="text-sm font-bold text-[var(--color-text-strong)]">File scanner alerts</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">High and critical detections appear here with the action taken.</p>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {fileScannerAlerts.slice(0, 6).map((alert) => (
                    <div key={alert._id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        {/* <p className="text-sm font-bold text-[var(--color-text-strong)]">{alert.message}</p> */}
                        <p className="line-clamp-2 text-sm font-bold text-[var(--color-text-strong)]">{alert.message}</p>
                        <span className={classNames(
                          'rounded-full px-2 py-1 text-xs font-bold uppercase ring-1',
                          alert.riskLevel === 'critical' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200',
                        )}>
                          {alert.riskLevel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Action: {alert.actionTaken} · {formatDate(alert.createdAt)}</p>
                    </div>
                  ))}
                  {!fileScannerAlerts.length ? (
                    <div className="p-4 text-sm text-[var(--color-text-muted)]">No high or critical file scanner alerts for the selected server.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_120px_120px_150px] items-center">
                <label className="relative flex w-full">
                  <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <InputText
                    className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20 search-file-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search files"
                  />
                </label>
                <Dropdown
                  className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm flex items-center transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
                  value={category}
                  onChange={(e) => setCategory(e.value as FileCategory | '')}
                  options={categoryOptions}
                  optionLabel="label"
                  optionValue="value"
                />
                <InputText
                  className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20"
                  value={minSizeMb}
                  onChange={(e) => setMinSizeMb(e.target.value)}
                  placeholder="Min MB"
                  keyfilter="int"
                />
                <InputText
                  className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20"
                  value={olderThanDays}
                  onChange={(e) => setOlderThanDays(e.target.value)}
                  placeholder="Older days"
                  keyfilter="int"
                />
                <Dropdown
                  className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm flex items-center transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.value as typeof sortKey)}
                  optionLabel="label"
                  optionValue="value"
                  options={[
                    { label: 'Category', value: 'category' },
                    { label: 'Size', value: 'sizeMb' },
                    { label: 'Last accessed', value: 'lastAccessed' },
                    { label: 'File name', value: 'fileName' },
                  ]}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
                <span className={classNames('rounded-full px-2 py-1 ring-1', isScanning || isFetchingScanResults ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-[var(--color-surface-muted)] ring-[var(--color-border)]')}>
                  {isScanning ? 'Scan running' : isFetchingScanResults ? 'Refreshing latest scan' : `Latest scan: ${sortedResults.length} files`}
                </span>
                {categoryOptions.slice(1).map((option) => (
                  <span key={option.value} className="rounded-full bg-[var(--color-surface-muted)] px-2 py-1">
                    {option.label}: {groupedCounts[option.value] ?? 0}
                  </span>
                ))}
              </div>
            </div>

            <div className="w-full max-h-[50vh] sm:max-h-[60vh] lg:max-h-[600px] overflow-auto">
              <table className="min-w-full divide-y divide-[var(--color-primary)] text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-[var(--color-primary)]"
                        checked={selectedFileIds.length > 0 && selectedFileIds.length === sortedResults.length}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = selectedFileIds.length > 0 && selectedFileIds.length < sortedResults.length
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFileIds(sortedResults.map((r) => r._id))
                          } else {
                            setSelectedFileIds([])
                          }
                        }}
                        aria-label="Select all files"
                      />
                    </th>
                    <th className="px-4 py-3">File name</th>
                    <th className="px-4 py-3">Directory</th>
                    <th className="px-4 py-3">Path</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Last accessed</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">AI analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {isLoadingScanResults || isServerDataLoading ? (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <TableSkeleton />
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((result) => (
                      <tr key={result._id} className="align-top hover:bg-[var(--color-hover)]">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedFileIds.includes(result._id)}
                            onChange={() => toggleSelected(result._id)}
                            aria-label={`Select ${result.fileName}`}
                          />
                        </td>
                        <td className="max-w-[220px] px-4 py-3 font-medium text-[var(--color-text-strong)]">
                          <div className="max-w-[220px] overflow-hidden">
                            <span className="block truncate" title={result.fileName}>{result.fileName}</span>
                          </div>
                        </td>
                        <td className="max-w-[240px] px-4 py-3 text-[var(--color-text-muted)]">
                          <div className="max-w-[240px] overflow-hidden">
                            <span className="block truncate" title={result.directory || result.scanRoot}>
                              {result.directory || result.scanRoot}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[360px] px-4 py-3 text-[var(--color-text-muted)]">
                          <div className="max-w-[360px] overflow-hidden">
                            <span className="block truncate" title={result.path}>
                              {result.path}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{formatBytes(result.size)}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatDate(result.lastAccessed)}</td>
                        <td className="px-4 py-3">
                          <span className={classNames('rounded-full px-2 py-1 text-xs font-semibold ring-1', categoryTone[result.category as FileCategory])}>
                            {result.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={classNames('rounded-full px-2 py-1 text-xs font-semibold ring-1', severityTone[result.severity ?? 'low'])}>
                            {result.severity ?? 'low'}
                          </span>
                        </td>
                        <td className="min-w-[420px] px-4 py-3">
                          <p className="font-medium text-[var(--color-text-strong)]">
                            {result.aiRecommendation.action} · {Math.round(result.aiRecommendation.confidence * 100)}%
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{result.aiRecommendation.reason}</p>
                          {result.rootCauseAnalysis ? (
                            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-strong)]">
                              Root cause: {result.rootCauseAnalysis}
                            </p>
                          ) : null}
                          {result.impactedServices?.length || result.impactedDirectories?.length ? (
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              Impact: {[...(result.impactedServices ?? []), ...(result.impactedDirectories ?? [])].slice(0, 3).join(', ')}
                            </p>
                          ) : null}
                          {result.devOpsRecommendations?.[0] ? (
                            <p className="mt-1 text-xs font-semibold text-[var(--color-primary)]">
                              {result.devOpsRecommendations[0]}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                  {!isLoadingScanResults && !isServerDataLoading && !sortedResults.length ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                        No scan findings for the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] p-4">
              <p className="text-sm font-medium text-[var(--color-text-muted)]">{selectedFileIds.length} selected</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-hover)]"
                  onClick={() => handleManualAction('ignore')}
                  disabled={!selectedFileIds.length || isActing}
                >
                  <Ban className="h-4 w-4" />
                  Ignore
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-primary)] px-3 text-sm font-semibold hover:bg-[var(--color-hover)] text-[var(--color-primary)]"
                  onClick={() => handleManualAction('archive')}
                  disabled={!selectedFileIds.length || isActing}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700"
                  onClick={() => handleManualAction('delete')}
                  disabled={!selectedFileIds.length || isActing}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <section className="flex flex-col h-[400px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Bot className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[var(--color-text-strong)] truncate">
                  AI action preview
                </h2>
              </div>
              <div className="ml-auto flex gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold whitespace-nowrap transition-colors hover:bg-[var(--color-hover)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => handleRunAgent(false)}
                  disabled={!selectedServerId || isLoadingAgentPreview}
                >
                  {isLoadingAgentPreview ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    'Preview'
                  )}
                </button>

                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white whitespace-nowrap transition-colors hover:bg-[var(--color-primary-hover)] focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => handleRunAgent(true)}
                  disabled={!selectedServerId || isLoadingAgentPreview}
                >
                  {isLoadingAgentPreview ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
            </div>
            <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
              {isLoadingAgentPreview && !agentPreview ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-muted)]">Generating AI preview...</p>
                  </div>
                </div>
              ) : null}
              {!isLoadingAgentPreview && agentPreview?.execution?.skippedReason ? (
                <p className="rounded-2xl bg-amber-50 p-4 text-sm font-medium text-amber-800">{agentPreview.execution.skippedReason}</p>
              ) : null}
              {!isLoadingAgentPreview && (agentPreview?.decisions ?? []).slice(0, 5).map((decision) => (
                <div key={decision.path} className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0">
                  <p className="truncate text-sm font-bold text-[var(--color-text-strong)]">{decision.recommendation.action}</p>
                  <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]" title={decision.path}>
                    {decision.path}
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">{decision.recommendation.reason}</p>
                </div>
              ))}
              {!isLoadingAgentPreview && !agentPreview ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm font-medium text-[var(--color-text-muted)]">
                    No AI preview generated yet, Click on Preview to generate AI preview.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col h-[400px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="text-lg font-bold text-[var(--color-text-strong)] truncate">
                Alerts
              </h2>
            </div>
            <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
              {alerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`rounded-2xl border p-4 transition-colors duration-200
                  ${alert.severity === 'critical'
                      ? 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2] hover:border-[#fca5a5] dark:border-[rgba(248,113,113,0.24)] dark:bg-[rgba(239,68,68,0.12)] dark:hover:bg-[rgba(239,68,68,0.18)]'
                      : alert.severity === 'success'
                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7] hover:border-[#86efac] dark:border-[rgba(74,222,128,0.24)] dark:bg-[rgba(34,197,94,0.12)] dark:hover:bg-[rgba(34,197,94,0.18)]'
                        : alert.severity === 'warning'
                          ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e] hover:bg-[#fef3c7] hover:border-[#fcd34d] dark:border-[rgba(250,204,21,0.24)] dark:bg-[rgba(234,179,8,0.12)] dark:hover:bg-[rgba(234,179,8,0.18)]'
                          : alert.severity === 'info'
                            ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe] hover:border-[#93c5fd] dark:border-[rgba(96,165,250,0.24)] dark:bg-[rgba(59,130,246,0.12)] dark:hover:bg-[rgba(59,130,246,0.18)]'
                            : 'border-[var(--color-border)]'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold leading-tight">{alert.title}</p>

                    <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold tracking-wide">
                      {alert.severity}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-relaxed">
                    {alert.message}
                  </p>

                  <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
                    {formatDate(alert.created)}
                  </p>
                </div>
              ))}
              {!alerts.length ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm font-medium text-[var(--color-text-muted)]">
                    No alerts.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </section>

        {selectedServerId && (
          <section className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mt-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-strong)] flex items-center gap-2">
                <Bot className="h-6 w-6 shrink-0 text-[var(--color-primary)]" />
                AI Predictive Insights
              </h2>
            </div>

            {(isLoadingLatestPrediction || isServerDataLoading || (isFetchingLatestPrediction && !predictiveInsights)) ? (
              <PredictSkeleton />
            ) : isLatestPredictionError ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6">
                <p className="text-sm font-medium text-rose-700">Stored predictive results could not be loaded right now.</p>
              </div>
            ) : !predictiveInsights ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
                <p className="text-lg font-bold text-[var(--color-text-strong)]">No stored prediction yet</p>
                <p className="text-sm text-[var(--color-text-muted)]">Background prediction runs will appear here after the scheduler completes for this server.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {predictiveInsights?.predictions.length ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {predictiveInsights.predictions.map((p, idx) => {
                      const severityStyles = getSeverityStyles(p.severity);
                      return (
                        <div key={idx} className={classNames(
                          "relative overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-lg",
                          severityStyles.border
                        )}>
                          <div className="flex items-start justify-between">
                            <span className={classNames(
                              "rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ring-1",
                              severityStyles.badge
                            )}>
                              {p.severity} Risk
                            </span>
                            <div className="flex items-center gap-1 text-sm font-bold text-[var(--color-text-strong)]">
                              <Activity className={classNames("h-4 w-4", severityStyles.text)} />
                              {Math.round(p.confidence * 100)}% Confidence
                            </div>
                          </div>

                          <h4 className="mt-4 text-lg font-black text-[var(--color-text-strong)] leading-tight">{p.issue}</h4>
                          <p className="mt-2 text-sm font-medium text-[var(--color-text-muted)]">{p.predictedFailure}</p>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-strong)]">{p.recommendation}</p>
                          {p.rootCauseAnalysis ? (
                            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                              Root cause: {p.rootCauseAnalysis}
                            </p>
                          ) : null}

                          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight">
                            <Monitor className="h-4 w-4" />
                            Horizon: {p.horizonMinutes} Minutes
                          </div>

                          <div className="mt-6 space-y-3">
                            <div className="rounded-2xl bg-[var(--color-surface-muted)] p-3 ring-1 ring-[var(--color-border)]">
                              <p className="text-xs font-bold text-[var(--color-text-strong)] uppercase">Evidence</p>
                              <ul className="mt-2 space-y-1">
                                {p.evidence.map((ev, i) => (
                                  <li key={i} className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                                    <div className={classNames("h-1 w-1 rounded-full ", severityStyles.bg)} />
                                    {typeof ev === 'string' ? ev : ev.detail}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* <div className={classNames("rounded-2xl bg-[var(--color-primary)]/5 p-3 ring-1 ring-[var(--color-primary)]/20", severityStyles.hover)}> */}
                            <div className={classNames("rounded-2xl p-3 ring-1", severityStyles.softRing, severityStyles.softBg)}>
                              <p className={classNames("text-xs font-bold uppercase", severityStyles.text)}>Next Actions</p>
                              <ul className="mt-2 space-y-1">
                                {p.recommendedActions.map((act, i) => (
                                  <li key={i} className="text-xs font-bold text-[var(--color-text-strong)] flex items-center gap-2">
                                    <Play className={classNames("h-3 w-3", severityStyles.text)} />
                                    {act}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {(p.impactedServices?.length || p.impactedDirectories?.length || p.affectedComponents?.length) ? (
                              <div className="rounded-2xl bg-[var(--color-surface-muted)] p-3 ring-1 ring-[var(--color-border)]">
                                <p className="text-xs font-bold text-[var(--color-text-strong)] uppercase">Impacted Areas</p>
                                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                                  {[...(p.affectedComponents ?? []), ...(p.impactedServices ?? []), ...(p.impactedDirectories ?? [])].slice(0, 6).join(', ')}
                                </p>
                              </div>
                            ) : null}

                            <button
                              onClick={() => handleRemediate(predictiveInsights!, p)}
                              disabled={isPlanningRemediation || isExecutingRemediation}
                              className={classNames("mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black shadow-lg shadow-[var(--color-primary)]/20 transition-all active:scale-[0.98] disabled:opacity-50", severityStyles.buttonBg, severityStyles.buttonText, severityStyles.buttonHover)}
                            >
                              <Zap className={classNames("h-4 w-4", (isPlanningRemediation || isExecutingRemediation) && "animate-pulse")} />
                              {isPlanningRemediation ? 'Planning...' : isExecutingRemediation ? 'Executing...' : 'Fix with AI Remediation'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[200px] rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                      <Activity className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-lg font-bold text-emerald-900">System Healthy</p>
                    <p className="text-sm text-emerald-700">No imminent failures predicted by AI advisor.</p>
                  </div>
                )}

                {/* {predictiveInsights?.trendAnalysis && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(predictiveInsights.trendAnalysis).map(([key, trend]: [string, any]) => (
                    <div key={key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{key.replace('Trend', '')}</p>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={classNames(
                          "text-xl font-black",
                          trend.slope > 0 ? "text-rose-500" : "text-emerald-500"
                        )}>
                          {trend.slope > 0 ? '↑' : '↓'} {Math.abs(trend.slope).toFixed(2)}%/min
                        </span>
                        {trend.anomalyScore > 0.7 && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 ring-1 ring-rose-300">
                            ANOMALY
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )} */}
              </div>
            )}
          </section>
        )}

        {predictionHistory.length > 0 && (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mt-5">
            <h2 className="text-lg font-bold text-[var(--color-text-strong)] mb-6 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[var(--color-primary)]" />
              Prediction History
            </h2>
            <div className="max-h-[40vh] sm:max-h-[50vh] lg:max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--color-surface)] text-left text-xs uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="pb-3 px-2">Date</th>
                    <th className="pb-3 px-2">Health</th>
                    <th className="pb-3 px-2">Issues Found</th>
                    <th className="pb-3 px-2">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {predictionHistory.map((pred) => (
                    <tr key={pred._id} className="group hover:bg-[var(--color-surface-muted)] transition-colors">
                      <td className="py-2 px-2 font-medium">{formatDate(pred.created)}</td>
                      <td className="py-2 px-2">
                        <span className={classNames(
                          "font-black",
                          pred.healthScore >= 80
                            ? "text-emerald-500"
                            : pred.healthScore >= 60
                              ? "text-blue-500"
                              : pred.healthScore >= 40
                                ? "text-amber-500"
                                : "text-rose-500"
                        )}>
                          {pred.healthScore}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        {pred.predictions.length ? (
                          <div className="flex gap-1 items-center">
                            {pred.predictions.map((p, i) => (
                              <span key={i} title={p.issue} className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                            ))}
                            <span className="text-xs font-bold text-[var(--color-text-strong)]">{pred.predictions.length} detected</span>
                          </div>
                        ) : 'None'}
                      </td>
                      <td className="py-2 px-2">
                        {pred.predictions[0] ? `${Math.round(pred.predictions[0].confidence * 100)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedFileIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
              <div className="flex flex-col border-r border-white/10 pr-4 mr-2">
                <span className="text-sm font-black text-[var(--color-text-strong)]">{selectedFileIds.length} files selected</span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Manual Cleanup Action</span>
              </div>
              <button
                onClick={() => handleManualAction('delete')}
                className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-rose-500 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                Delete Permanently
              </button>
              <button
                onClick={() => handleManualAction('archive')}
                className="flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--color-primary-hover)] active:ring-[var(--color-primary)]/40"
              >
                <Archive className="h-4 w-4" />
                Archive
              </button>
              <button
                onClick={() => setSelectedFileIds([])}
                className="ml-2 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
