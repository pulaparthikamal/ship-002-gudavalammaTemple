import { apiSlice } from '@/services/api/apiSlice'
import { LONG_RUNNING_API_TIMEOUT_MS } from '@/services/api/apiConfig'
import { readResponsePath } from '@/services/api/responseTransform'
import type {
  Alert,
  ConnectServerPayload,
  CleanupRecommendationResponse,
  CleanupTimelineRecord,
  CpuMetricPoint,
  DiskCleanupHistory,
  DiskCleanupJob,
  DiskCleanupPolicy,
  DiskCleanupScanResult,
  FileScannerAlert,
  FileScannerQuery,
  FileScannerStatus,
  FileScanEvent,
  FileScanResult,
  MaintenanceConfig,
  MaintenanceLog,
  MaintenanceReport,
  LogsIntelligence,
  LogsQueryParams,
  LogsQueryResponse,
  LogSeverity,
  Metric,
  MetricDefinitionsResponse,
  MetricQueryParams,
  MetricQueryResponse,
  MonitoringHealthScore,
  MonitoringMetricHistory,
  MonitoringResourceSpike,
  MonitoringStatus,
  Prediction,
  QuarantinedFile,
  RemediationJob,
  ScanResult,
  ServerConnection,
  ServerProject,
} from '@/types/serverManagement'

const data = <T>(response: unknown) => readResponsePath<T>(response, 'data')

function hasPemFile(payload: Partial<ConnectServerPayload>): payload is Partial<ConnectServerPayload> & { pemFile: File } {
  return payload.pemFile instanceof File
}

function toServerFormData(payload: Partial<ConnectServerPayload>) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'pemFile' && value instanceof File) {
      formData.append('pemFile', value)
      return
    }
    if (key === 'scanDirectories' && Array.isArray(value)) {
      formData.append(key, value.join(','))
      return
    }
    if (key !== 'pemFile') {
      formData.append(key, String(value))
    }
  })
  return formData
}

function withoutPemFile<T extends Partial<ConnectServerPayload>>(payload: T): Omit<T, 'pemFile'> {
  const { pemFile: _pemFile, ...rest } = payload
  return rest
}

const cleanParams = <T extends Record<string, unknown>>(params: T) =>
  Object.entries(params).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return acc
    }

    if (key === 'category' && typeof value === 'object') {
      const categoryValue = (value as { value?: string; label?: string }).value
      if (!categoryValue) {
        return acc
      }
      acc[key] = categoryValue
      return acc
    }

    acc[key] = value
    return acc
  }, {})

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

interface StartScanResponse {
  scanId: string
  fileCount: number
  reviewRequired: boolean
  analysis?: {
    analyzedCount: number
    predictionsCreated: number
    predictionId?: string
  }
}

type RemediationPlanPayload =
  | {
      serverId: string
      type: RemediationJob['type']
      target: string
      description: string
      predictionId?: string
      incidentId?: string
    }
  | {
      serverId: string
      intent: string
      context?: Record<string, unknown>
      description?: string
      approvalMode?: 'manual' | 'auto'
      predictionId?: string
      incidentId?: string
    }

export const serverManagementApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getServers: builder.query<ServerConnection[], void>({
      query: () => ({ url: 'serverAgent/servers/list' }),
      transformResponse: data<ServerConnection[]>,
      providesTags: [{ type: 'Server', id: 'LIST' }],
    }),
    collectMetrics: builder.mutation<{ success: boolean }, { serverId: string }>({
      query: (payload) => ({ url: 'serverAgent/dashboard/sync', method: 'POST', data: payload }),
      invalidatesTags: ['Metric'],
    }),
    connectServer: builder.mutation<ServerConnection, ConnectServerPayload>({
      query: (payload) =>
        hasPemFile(payload)
          ? { url: 'serverAgent/servers/connect/upload', method: 'POST', data: toServerFormData(payload) }
          : { url: 'serverAgent/servers/connect', method: 'POST', data: withoutPemFile(payload) },
      invalidatesTags: [{ type: 'Server', id: 'LIST' }],
    }),
    updateServer: builder.mutation<ServerConnection, { id: string; data: Partial<ConnectServerPayload> }>({
      query: ({ id, data }) =>
        hasPemFile(data)
          ? { url: `serverAgent/servers/${id}/upload`, method: 'PATCH', data: toServerFormData(data) }
          : { url: `serverAgent/servers/${id}`, method: 'PATCH', data: withoutPemFile(data) },
      invalidatesTags: [{ type: 'Server', id: 'LIST' }],
    }),
    deleteServer: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `serverAgent/servers/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Server', id: 'LIST' }],
    }),
    getServerProjects: builder.query<ServerProject[], string>({
      query: (serverId) => ({ url: `serverAgent/servers/${serverId}/projects` }),
      transformResponse: data<ServerProject[]>,
      providesTags: [{ type: 'ServerProject', id: 'LIST' }],
    }),
    syncServerProjects: builder.mutation<ServerProject[], string>({
      query: (serverId) => ({
        url: `serverAgent/servers/${serverId}/projects/sync`,
        method: 'POST',
        timeout: LONG_RUNNING_API_TIMEOUT_MS,
      }),
      transformResponse: data<ServerProject[]>,
      invalidatesTags: [{ type: 'ServerProject', id: 'LIST' }],
    }),
    getAlerts: builder.query<Alert[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/alerts', params }),
      transformResponse: data<Alert[]>,
      providesTags: ['Alert'],
    }),
    getConfig: builder.query<MaintenanceConfig, string>({
      query: (serverId) => ({ url: 'serverAgent/configuration', params: { serverId } }),
      transformResponse: data<MaintenanceConfig>,
      providesTags: ['Config'],
    }),
    getLogs: builder.query<MaintenanceLog[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/logs', params }),
      transformResponse: data<MaintenanceLog[]>,
      providesTags: ['Log'],
    }),
    getLogsIntelligence: builder.query<LogsIntelligence, { serverId?: string; severity?: LogSeverity[] }>({
      query: ({ severity, ...params }) => ({
        url: 'serverAgent/logs/intelligence',
        params: {
          ...params,
          severity: severity?.join(','),
        },
      }),
      transformResponse: data<LogsIntelligence>,
      providesTags: ['Log'],
    }),
    queryLogs: builder.query<LogsQueryResponse, LogsQueryParams>({
      query: ({ severity, source, errorSecurityOnly, ...params }) => ({
        url: 'serverAgent/logs/query',
        params: cleanParams({
          ...params,
          severity: severity?.join(','),
          source: source?.join(','),
          errorSecurityOnly: errorSecurityOnly ? 'true' : undefined,
        }),
      }),
      transformResponse: data<LogsQueryResponse>,
      providesTags: ['Log'],
    }),
    collectLogsIntelligence: builder.mutation<
      { sources: Array<{ source: string; rawInserted: number; processedInserted: number }> },
      { serverId: string; sources?: string[] }
    >({
      query: (payload) => ({ url: 'serverAgent/logs/intelligence/collect', method: 'POST', data: payload }),
      invalidatesTags: ['Log'],
    }),
    getFileScannerStatus: builder.query<FileScannerStatus, string | undefined>({
      query: (serverId) => ({ url: serverId ? `serverAgent/${serverId}/file-scanner/status` : 'serverAgent/file-scanner/status' }),
      transformResponse: data<FileScannerStatus>,
      providesTags: ['Alert'],
    }),
    runFileScannerSweep: builder.mutation<FileScannerStatus, string>({
      query: (serverId) => ({ url: `serverAgent/${serverId}/file-scanner/scan-now`, method: 'POST' }),
      transformResponse: data<FileScannerStatus>,
      invalidatesTags: ['Alert'],
    }),
    getFileScanEvents: builder.query<FileScanEvent[], FileScannerQuery>({
      query: ({ serverId, ...params }) => ({ url: serverId ? `serverAgent/${serverId}/file-scanner/events` : 'serverAgent/file-scanner/events', params: cleanParams({ ...params }) }),
      transformResponse: data<FileScanEvent[]>,
      providesTags: ['Alert'],
    }),
    getFileScanResults: builder.query<FileScanResult[], FileScannerQuery>({
      query: ({ serverId, ...params }) => ({ url: serverId ? `serverAgent/${serverId}/file-scanner/results` : 'serverAgent/file-scanner/results', params: cleanParams({ ...params }) }),
      transformResponse: data<FileScanResult[]>,
      providesTags: ['Alert'],
    }),
    getFileScanResult: builder.query<FileScanResult | null, string>({
      query: (id) => ({ url: `serverAgent/file-scanner/results/${id}` }),
      transformResponse: data<FileScanResult | null>,
    }),
    getQuarantinedFiles: builder.query<QuarantinedFile[], FileScannerQuery>({
      query: ({ serverId, ...params }) => ({ url: serverId ? `serverAgent/${serverId}/file-scanner/quarantine` : 'serverAgent/file-scanner/quarantine', params: cleanParams({ ...params }) }),
      transformResponse: data<QuarantinedFile[]>,
      providesTags: ['Alert'],
    }),
    getFileScannerAlerts: builder.query<FileScannerAlert[], FileScannerQuery>({
      query: ({ serverId, ...params }) => ({ url: serverId ? `serverAgent/${serverId}/file-scanner/alerts` : 'serverAgent/file-scanner/alerts', params: cleanParams({ ...params }) }),
      transformResponse: data<FileScannerAlert[]>,
      providesTags: ['Alert'],
    }),
    restoreQuarantinedFile: builder.mutation<FileScanResult, string>({
      query: (id) => ({ url: `serverAgent/file-scanner/results/${id}/restore`, method: 'POST' }),
      transformResponse: data<FileScanResult>,
      invalidatesTags: ['Alert'],
    }),
    markFileScanSafe: builder.mutation<FileScanResult, string>({
      query: (id) => ({ url: `serverAgent/file-scanner/results/${id}/mark-safe`, method: 'POST' }),
      transformResponse: data<FileScanResult>,
      invalidatesTags: ['Alert'],
    }),
    permanentDeleteQuarantinedFile: builder.mutation<FileScanResult, string>({
      query: (id) => ({ url: `serverAgent/file-scanner/results/${id}/permanent-delete`, method: 'DELETE' }),
      transformResponse: data<FileScanResult>,
      invalidatesTags: ['Alert'],
    }),
    activityList: builder.query<MaintenanceLog[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/logs', params }),
      transformResponse: data<MaintenanceLog[]>,
    }),
    getMetrics: builder.query<Metric[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/dashboard', params }),
      transformResponse: data<Metric[]>,
      providesTags: ['Metric'],
    }),
    getMonitoringStatus: builder.query<MonitoringStatus, { serverId?: string }>({
      query: (params) => ({ url: 'serverAgent/dashboard/monitoring/status', params }),
      transformResponse: data<MonitoringStatus>,
      providesTags: ['MonitoringMetric'],
    }),
    getMonitoringHistory: builder.query<MonitoringMetricHistory[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/dashboard/monitoring/history', params }),
      transformResponse: data<MonitoringMetricHistory[]>,
      providesTags: ['MonitoringMetric'],
    }),
    getMonitoringCpuTrend: builder.query<MonitoringMetricHistory[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/dashboard/monitoring/cpu-trend', params }),
      transformResponse: data<MonitoringMetricHistory[]>,
      providesTags: ['MonitoringMetric'],
    }),
    getServerMetricsHistory: builder.query<MonitoringMetricHistory[], { serverId: string; range?: '30m' | '1h' | '4h' | '6h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom'; startTime?: string; endTime?: string }>({
      query: ({ serverId, range = '24h', startTime, endTime }) => ({
        url: `serverAgent/${serverId}/metrics`,
        params: cleanParams({ range, startTime, endTime }),
      }),
      transformResponse: data<MonitoringMetricHistory[]>,
      providesTags: ['MonitoringMetric'],
    }),
    getCpuMetrics: builder.query<CpuMetricPoint[], { serverId: string; range?: '30m' | '1h' | '4h' | '6h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom'; startTime?: string; endTime?: string }>({
      query: ({ serverId, range = '24h', startTime, endTime }) => ({
        url: `serverAgent/${serverId}/metrics/cpu`,
        params: cleanParams({ range, startTime, endTime }),
      }),
      transformResponse: data<CpuMetricPoint[]>,
      providesTags: ['MonitoringMetric'],
    }),
    getMetricDefinitions: builder.query<MetricDefinitionsResponse, void>({
      query: () => ({ url: 'serverAgent/metrics/definitions' }),
      transformResponse: data<MetricDefinitionsResponse>,
      providesTags: ['MonitoringMetric'],
    }),
    getMetricSeries: builder.query<MetricQueryResponse, MetricQueryParams>({
      query: (params) => ({ url: 'serverAgent/metrics/query', params: cleanParams({ ...params }) }),
      transformResponse: data<MetricQueryResponse>,
      providesTags: ['MonitoringMetric'],
    }),
    getLatestMonitoringHealth: builder.query<MonitoringHealthScore | null, { serverId: string }>({
      query: (params) => ({ url: 'serverAgent/dashboard/monitoring/health/latest', params }),
      transformResponse: data<MonitoringHealthScore | null>,
      providesTags: ['MonitoringHealth'],
    }),
    getMonitoringHealthScores: builder.query<MonitoringHealthScore[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/dashboard/monitoring/health', params }),
      transformResponse: data<MonitoringHealthScore[]>,
      providesTags: ['MonitoringHealth'],
    }),
    getMonitoringSpikes: builder.query<MonitoringResourceSpike[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/dashboard/monitoring/spikes', params }),
      transformResponse: data<MonitoringResourceSpike[]>,
      providesTags: ['MonitoringSpike'],
    }),
    collectLightweightMonitoring: builder.mutation<
      {
        metric: MonitoringMetricHistory
        healthScore: MonitoringHealthScore
        spikes: MonitoringResourceSpike[]
      },
      { serverId: string }
    >({
      query: (payload) => ({ url: 'serverAgent/dashboard/monitoring/collect', method: 'POST', data: payload }),
      transformResponse: data<{
        metric: MonitoringMetricHistory
        healthScore: MonitoringHealthScore
        spikes: MonitoringResourceSpike[]
      }>,
      invalidatesTags: ['MonitoringMetric', 'MonitoringHealth', 'MonitoringSpike'],
    }),
    getReport: builder.query<MaintenanceReport, { serverId: string; days?: number }>({
      query: (params) => ({ url: 'serverAgent/reports', params }),
      transformResponse: data<MaintenanceReport>,
    }),
    getScanResults: builder.query<ScanResult[], { serverId?: string; category?: string | { label?: string; value?: string }; search?: string; minSizeMb?: string; olderThanDays?: string; markReviewed?: boolean; latest?: boolean; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/scan/results', params: cleanParams(params) }),
      transformResponse: data<ScanResult[]>,
      providesTags: ['ScanResult'],
    }),
    manualAction: builder.mutation<{ success: boolean }, { serverId: string; fileIds: string[]; action: string; reason: string }>({
      query: (payload) => ({ url: 'serverAgent/manual/action', method: 'POST', data: payload }),
      invalidatesTags: ['ScanResult', 'Log'],
    }),
    getCleanupRecommendations: builder.mutation<CleanupRecommendationResponse, { serverId: string; directories?: string[] }>({
      query: (payload) => ({
        url: 'serverAgent/scan/cleanup-recommendations',
        method: 'POST',
        data: payload,
        timeout: LONG_RUNNING_API_TIMEOUT_MS,
      }),
      transformResponse: data<CleanupRecommendationResponse>,
      invalidatesTags: ['ScanResult', 'Log', 'Alert'],
    }),
    getCleanupTimeline: builder.query<CleanupTimelineRecord[], { serverId?: string }>({
      query: (params) => ({ url: 'serverAgent/cleanup/timeline', params: cleanParams(params) }),
      transformResponse: data<CleanupTimelineRecord[]>,
      providesTags: ['Log'],
    }),
    getCleanupSummary: builder.query<CleanupTimelineRecord | null, { scanId: string; serverId?: string }>({
      query: ({ scanId, ...params }) => ({ url: `serverAgent/cleanup/summary/${scanId}`, params: cleanParams(params) }),
      transformResponse: data<CleanupTimelineRecord | null>,
      providesTags: ['Log'],
    }),
    executeCleanupSummary: builder.mutation<CleanupTimelineRecord, { scanId: string; serverId: string }>({
      query: ({ scanId, serverId }) => ({
        url: `serverAgent/cleanup/execute/${scanId}`,
        method: 'POST',
        data: { serverId },
        timeout: LONG_RUNNING_API_TIMEOUT_MS,
      }),
      transformResponse: data<CleanupTimelineRecord>,
      invalidatesTags: ['ScanResult', 'Log', 'Alert'],
    }),
    getDiskCleanupPolicy: builder.query<DiskCleanupPolicy, string>({
      query: (serverId) => ({ url: `serverAgent/disk-cleanup/policy/${serverId}` }),
      transformResponse: data<DiskCleanupPolicy>,
      providesTags: ['Config'],
    }),
    saveDiskCleanupPolicy: builder.mutation<DiskCleanupPolicy, Partial<DiskCleanupPolicy> & { serverId: string }>({
      query: (payload) => ({ url: 'serverAgent/disk-cleanup/policy', method: 'POST', data: payload }),
      transformResponse: data<DiskCleanupPolicy>,
      invalidatesTags: ['Config'],
    }),
    scanDiskCleanup: builder.mutation<DiskCleanupScanResult, { serverId: string; dryRun?: boolean; domainName?: string }>({
      query: ({ serverId, ...data }) => ({
        url: `serverAgent/disk-cleanup/scan/${serverId}`,
        method: 'POST',
        data,
        timeout: LONG_RUNNING_API_TIMEOUT_MS,
      }),
      transformResponse: data<DiskCleanupScanResult>,
      invalidatesTags: ['Log', { type: 'Server', id: 'LIST' }],
    }),
    executeDiskCleanup: builder.mutation<DiskCleanupJob, { serverId: string; dryRun?: boolean; domainName?: string }>({
      query: ({ serverId, ...data }) => ({
        url: `serverAgent/disk-cleanup/execute/${serverId}`,
        method: 'POST',
        data,
        timeout: LONG_RUNNING_API_TIMEOUT_MS,
      }),
      transformResponse: data<DiskCleanupJob>,
      invalidatesTags: ['Log', 'Alert', 'MonitoringMetric', { type: 'Server', id: 'LIST' }],
    }),
    getDiskCleanupHistory: builder.query<DiskCleanupHistory[], { serverId: string; limit?: number }>({
      query: ({ serverId, ...params }) => ({ url: `serverAgent/disk-cleanup/history/${serverId}`, params: cleanParams(params) }),
      transformResponse: data<DiskCleanupHistory[]>,
      providesTags: ['Log'],
    }),
    getDiskCleanupJobs: builder.query<DiskCleanupJob[], { serverId: string; limit?: number }>({
      query: ({ serverId, ...params }) => ({ url: `serverAgent/disk-cleanup/jobs/${serverId}`, params: cleanParams(params) }),
      transformResponse: data<DiskCleanupJob[]>,
      providesTags: ['Log'],
    }),
    getLatestDiskCleanupSummary: builder.query<DiskCleanupJob | null, { serverId: string }>({
      query: ({ serverId }) => ({ url: `serverAgent/disk-cleanup/latest-summary/${serverId}` }),
      transformResponse: data<DiskCleanupJob | null>,
      providesTags: ['Log'],
    }),
    runAgent: builder.mutation<AgentPreview, { serverId: string; execute?: boolean }>({
      query: (payload) => ({ url: 'serverAgent/agent/run', method: 'POST', data: payload }),
      transformResponse: data<AgentPreview>,
      invalidatesTags: ['ScanResult', 'Log', 'Alert'],
    }),
    saveConfig: builder.mutation<MaintenanceConfig, Partial<MaintenanceConfig> & { serverId: string }>({
      query: (payload) => ({ url: 'serverAgent/configuration/save', method: 'POST', data: payload }),
      invalidatesTags: ['Config'],
    }),
    startScan: builder.mutation<StartScanResponse, { serverId: string }>({
      query: (payload) => ({ url: 'serverAgent/scan/start', method: 'POST', data: payload }),
      transformResponse: data<StartScanResponse>,
      invalidatesTags: ['ScanResult', 'Log', 'Alert', { type: 'Server', id: 'LIST' }, { type: 'Prediction', id: 'LIST' }, { type: 'Prediction', id: 'LATEST' }],
    }),
    predictMaintenance: builder.mutation<Prediction, { serverId: string }>({
      query: (payload) => ({ url: 'serverAgent/agent/predict', method: 'POST', data: payload }),
      transformResponse: data<Prediction>,
      invalidatesTags: [{ type: 'Prediction', id: 'LIST' }],
    }),
    getPredictions: builder.query<Prediction[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/agent/predictions', params }),
      transformResponse: data<Prediction[]>,
      providesTags: [{ type: 'Prediction', id: 'LIST' }],
    }),
    getLatestPrediction: builder.query<Prediction | null, { serverId: string }>({
      query: (params) => ({ url: 'serverAgent/agent/predictions/latest', params }),
      transformResponse: data<Prediction | null>,
      providesTags: [{ type: 'Prediction', id: 'LATEST' }],
    }),
    addFeedback: builder.mutation<Prediction, { id: string; rating: number; comment?: string }>({
      query: ({ id, ...data }) => ({
        url: `serverAgent/agent/predictions/${id}/feedback`,
        method: 'POST',
        data,
      }),
      transformResponse: data<Prediction>,
      invalidatesTags: [{ type: 'Prediction', id: 'LIST' }, { type: 'Prediction', id: 'LATEST' }],
    }),
    
    // Remediation Endpoints
    getRemediationJobs: builder.query<RemediationJob[], { serverId?: string; limit?: number }>({
      query: (params) => ({ url: 'serverAgent/remediation/list', params }),
      transformResponse: data<RemediationJob[]>,
      providesTags: [{ type: 'Remediation', id: 'LIST' }],
    }),
    planRemediation: builder.mutation<RemediationJob, RemediationPlanPayload>({
      query: (payload) => ({ url: 'serverAgent/remediation/plan', method: 'POST', data: payload }),
      transformResponse: data<RemediationJob>,
      invalidatesTags: [{ type: 'Remediation', id: 'LIST' }],
    }),
    executeRemediation: builder.mutation<RemediationJob, string>({
      query: (id) => ({
        url: `serverAgent/remediation/${id}/execute`,
        method: 'POST',
        timeout: LONG_RUNNING_API_TIMEOUT_MS,
      }),
      transformResponse: data<RemediationJob>,
      invalidatesTags: [{ type: 'Remediation', id: 'LIST' }],
    }),
    rollbackRemediation: builder.mutation<RemediationJob, string>({
      query: (id) => ({ url: `serverAgent/remediation/${id}/rollback`, method: 'POST' }),
      transformResponse: data<RemediationJob>,
      invalidatesTags: [{ type: 'Remediation', id: 'LIST' }],
    }),
    cancelRemediation: builder.mutation<RemediationJob, string>({
      query: (id) => ({ url: `serverAgent/remediation/${id}/cancel`, method: 'POST' }),
      transformResponse: data<RemediationJob>,
      invalidatesTags: [{ type: 'Remediation', id: 'LIST' }],
    }),
  }),
})

export const {
  useCollectMetricsMutation,
  useConnectServerMutation,
  useUpdateServerMutation,
  useDeleteServerMutation,
  useGetAlertsQuery,
  useGetConfigQuery,
  useGetLogsQuery,
  useGetLogsIntelligenceQuery,
  useQueryLogsQuery,
  useCollectLogsIntelligenceMutation,
  useGetFileScannerStatusQuery,
  useRunFileScannerSweepMutation,
  useGetFileScanEventsQuery,
  useGetFileScanResultsQuery,
  useGetFileScanResultQuery,
  useGetQuarantinedFilesQuery,
  useGetFileScannerAlertsQuery,
  useRestoreQuarantinedFileMutation,
  useMarkFileScanSafeMutation,
  usePermanentDeleteQuarantinedFileMutation,
  useActivityListQuery,
  useGetMetricsQuery,
  useGetMonitoringStatusQuery,
  useGetMonitoringHistoryQuery,
  useGetMonitoringCpuTrendQuery,
  useGetServerMetricsHistoryQuery,
  useGetCpuMetricsQuery,
  useGetMetricDefinitionsQuery,
  useGetMetricSeriesQuery,
  useLazyGetMetricSeriesQuery,
  useGetLatestMonitoringHealthQuery,
  useGetMonitoringHealthScoresQuery,
  useGetMonitoringSpikesQuery,
  useCollectLightweightMonitoringMutation,
  useGetReportQuery,
  useGetScanResultsQuery,
  useGetServersQuery,
  useGetServerProjectsQuery,
  useSyncServerProjectsMutation,
  useManualActionMutation,
  useGetCleanupRecommendationsMutation,
  useGetCleanupSummaryQuery,
  useGetCleanupTimelineQuery,
  useExecuteCleanupSummaryMutation,
  useGetDiskCleanupPolicyQuery,
  useSaveDiskCleanupPolicyMutation,
  useScanDiskCleanupMutation,
  useExecuteDiskCleanupMutation,
  useGetDiskCleanupHistoryQuery,
  useGetDiskCleanupJobsQuery,
  useGetLatestDiskCleanupSummaryQuery,
  useRunAgentMutation,
  useSaveConfigMutation,
  useStartScanMutation,
  usePredictMaintenanceMutation,
  useGetPredictionsQuery,
  useGetLatestPredictionQuery,
  useAddFeedbackMutation,
  useGetRemediationJobsQuery,
  usePlanRemediationMutation,
  useExecuteRemediationMutation,
  useRollbackRemediationMutation,
  useCancelRemediationMutation,
} = serverManagementApi
