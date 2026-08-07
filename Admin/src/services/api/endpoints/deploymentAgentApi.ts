import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  Application,
  Credential,
  CreateApplicationPayload,
  CreateCredentialPayload,
  CreateDeploymentTargetPayload,
  Deployment,
  DeploymentLog,
  DeploymentLogsQuery,
  DeploymentPrediction,
  DeploymentTarget,
  IAutoDeploy,
  IVersionRecord,
  IRollbackRecord,
  PredictDeploymentPayload,
  PredictionsQuery,
  RollbackAnalysis,
  RollbackStats,
  RotateWebhookSecretResponse,
  TriggerDeploymentPayload,
} from '@/types/deploymentAgent'

const data = <T>(response: unknown) => readResponsePath<T>(response, 'data')

const DATA_PATHS = ['data', 'data.data', 'items']
const TOTAL_PATHS = ['meta.total', 'data.total', 'total']

interface DeploymentsQuery {
  applicationId?: string
  page?: string
  limit?: string
}

function normalizeList<T extends { _id: string }>(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<T> {
  return normalizeCrudListResponse<unknown, T>({
    response,
    query,
    dataPaths: DATA_PATHS,
    totalPaths: TOTAL_PATHS,
    mapItem: (item) => {
      if (typeof item !== 'object' || item === null) return null
      const obj = item as Record<string, unknown>
      if (typeof obj._id !== 'string') return null
      return obj as unknown as T
    },
  })
}

export const deploymentAgentApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Credentials ──────────────────────────────────────────────────────────

    listCredentials: builder.query<CrudListResponse<Credential>, CrudListQuery>({
      query: () => ({ url: 'deploymentAgent/credentials' }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeList<Credential>(response, query),
      providesTags: (result) =>
        result
          ? [
            ...result.data.map((c) => ({ type: 'DeploymentCredential' as const, id: c._id })),
            { type: 'DeploymentCredential' as const, id: 'LIST' },
          ]
          : [{ type: 'DeploymentCredential' as const, id: 'LIST' }],
    }),

    getCredentials: builder.query<Credential[], void>({
      query: () => ({ url: 'deploymentAgent/credentials' }),
      transformResponse: data<Credential[]>,
      providesTags: [{ type: 'DeploymentCredential', id: 'LIST' }],
    }),

    createCredential: builder.mutation<Credential, CreateCredentialPayload>({
      query: (payload) => ({ url: 'deploymentAgent/credentials', method: 'POST', data: payload }),
      transformResponse: data<Credential>,
      invalidatesTags: [{ type: 'DeploymentCredential', id: 'LIST' }],
    }),

    updateCredential: builder.mutation<Credential, { id: EntityId; data: Partial<CreateCredentialPayload> }>({
      query: ({ id, data: body }) => ({ url: `deploymentAgent/credentials/${id}`, method: 'PUT', data: body }),
      transformResponse: data<Credential>,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'DeploymentCredential', id },
        { type: 'DeploymentCredential', id: 'LIST' },
      ],
    }),

    deleteCredential: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `deploymentAgent/credentials/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'DeploymentCredential', id },
        { type: 'DeploymentCredential', id: 'LIST' },
      ],
    }),

    bulkDeleteCredentials: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({ url: 'deploymentAgent/credentials/multiDelete', method: 'POST', data: payload }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'DeploymentCredential' as const, id })),
        { type: 'DeploymentCredential' as const, id: 'LIST' },
      ],
    }),

    // ─── Deployment Targets ───────────────────────────────────────────────────

    listDeploymentTargets: builder.query<CrudListResponse<DeploymentTarget>, CrudListQuery>({
      query: () => ({ url: 'deploymentAgent/targets' }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeList<DeploymentTarget>(response, query),
      providesTags: (result) =>
        result
          ? [
            ...result.data.map((t) => ({ type: 'DeploymentTarget' as const, id: t._id })),
            { type: 'DeploymentTarget' as const, id: 'LIST' },
          ]
          : [{ type: 'DeploymentTarget' as const, id: 'LIST' }],
    }),

    getDeploymentTargets: builder.query<DeploymentTarget[], void>({
      query: () => ({ url: 'deploymentAgent/targets' }),
      transformResponse: data<DeploymentTarget[]>,
      providesTags: [{ type: 'DeploymentTarget', id: 'LIST' }],
    }),

    createDeploymentTarget: builder.mutation<DeploymentTarget, CreateDeploymentTargetPayload>({
      query: (payload) => ({ url: 'deploymentAgent/targets', method: 'POST', data: payload }),
      transformResponse: data<DeploymentTarget>,
      invalidatesTags: [{ type: 'DeploymentTarget', id: 'LIST' }],
    }),

    updateDeploymentTarget: builder.mutation<DeploymentTarget, { id: EntityId; data: Partial<CreateDeploymentTargetPayload> }>({
      query: ({ id, data: body }) => ({ url: `deploymentAgent/targets/${id}`, method: 'PUT', data: body }),
      transformResponse: data<DeploymentTarget>,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'DeploymentTarget', id },
        { type: 'DeploymentTarget', id: 'LIST' },
      ],
    }),

    deleteDeploymentTarget: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `deploymentAgent/targets/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'DeploymentTarget', id },
        { type: 'DeploymentTarget', id: 'LIST' },
      ],
    }),

    bulkDeleteDeploymentTargets: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({ url: 'deploymentAgent/targets/multiDelete', method: 'POST', data: payload }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'DeploymentTarget' as const, id })),
        { type: 'DeploymentTarget' as const, id: 'LIST' },
      ],
    }),

    testTargetConnection: builder.mutation<{ reachable: boolean; message: string }, EntityId>({
      query: (id) => ({ url: `deploymentAgent/targets/${id}/test-connection`, method: 'POST' }),
      transformResponse: data<{ reachable: boolean; message: string }>,
      invalidatesTags: (_result, _error, id) => [{ type: 'DeploymentTarget', id }],
    }),

    // ─── Applications ─────────────────────────────────────────────────────────

    listApplications: builder.query<CrudListResponse<Application>, CrudListQuery>({
      query: () => ({ url: 'deploymentAgent/applications' }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeList<Application>(response, query),
      providesTags: (result) =>
        result
          ? [
            ...result.data.map((a) => ({ type: 'DeploymentApplication' as const, id: a._id })),
            { type: 'DeploymentApplication' as const, id: 'LIST' },
          ]
          : [{ type: 'DeploymentApplication' as const, id: 'LIST' }],
    }),

    getApplications: builder.query<Application[], void>({
      query: () => ({ url: 'deploymentAgent/applications' }),
      transformResponse: data<Application[]>,
      providesTags: [{ type: 'DeploymentApplication', id: 'LIST' }],
    }),

    createApplication: builder.mutation<Application, CreateApplicationPayload>({
      query: (payload) => ({ url: 'deploymentAgent/applications', method: 'POST', data: payload }),
      transformResponse: data<Application>,
      invalidatesTags: [{ type: 'DeploymentApplication', id: 'LIST' }],
    }),

    updateApplication: builder.mutation<Application, { id: EntityId; data: Partial<CreateApplicationPayload> }>({
      query: ({ id, data: body }) => ({ url: `deploymentAgent/applications/${id}`, method: 'PUT', data: body }),
      transformResponse: data<Application>,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'DeploymentApplication', id },
        { type: 'DeploymentApplication', id: 'LIST' },
      ],
    }),

    deleteApplication: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `deploymentAgent/applications/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'DeploymentApplication', id },
        { type: 'DeploymentApplication', id: 'LIST' },
      ],
    }),

    bulkDeleteApplications: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({ url: 'deploymentAgent/applications/multiDelete', method: 'POST', data: payload }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'DeploymentApplication' as const, id })),
        { type: 'DeploymentApplication' as const, id: 'LIST' },
      ],
    }),

    rotateWebhookSecret: builder.mutation<RotateWebhookSecretResponse, EntityId>({
      query: (id) => ({ url: `deploymentAgent/applications/${id}/webhook/rotate-secret`, method: 'POST' }),
      transformResponse: data<RotateWebhookSecretResponse>,
      invalidatesTags: (_result, _error, id) => [
        { type: 'DeploymentApplication', id },
      ],
    }),

    updateAutoDeploy: builder.mutation<Application, { id: EntityId; data: IAutoDeploy }>({
      query: ({ id, data: body }) => ({ url: `deploymentAgent/applications/${id}/auto-deploy`, method: 'PATCH', data: body }),
      transformResponse: data<Application>,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'DeploymentApplication', id },
        { type: 'DeploymentApplication', id: 'LIST' },
      ],
    }),

    // ─── Deployments ──────────────────────────────────────────────────────────

    getDeployments: builder.query<{ data: Deployment[]; total: number }, DeploymentsQuery>({
      query: (params) => ({ url: 'deploymentAgent/deployments', params }),
      transformResponse: (response: unknown) => ({
        data: readResponsePath<Deployment[]>(response, 'data') ?? [],
        total: readResponsePath<number>(response, 'meta.total') ?? 0,
      }),
      providesTags: (result) =>
        result
          ? [
            ...result.data.map((d) => ({ type: 'Deployment' as const, id: d._id })),
            { type: 'Deployment' as const, id: 'LIST' },
          ]
          : [{ type: 'Deployment' as const, id: 'LIST' }],
    }),

    getDeploymentById: builder.query<Deployment, string>({
      query: (id) => ({ url: `deploymentAgent/deployments/${id}` }),
      transformResponse: data<Deployment>,
      providesTags: (_result, _error, id) => [{ type: 'Deployment', id }],
    }),

    triggerDeployment: builder.mutation<Deployment, TriggerDeploymentPayload>({
      query: (payload) => ({ url: 'deploymentAgent/deployments/trigger', method: 'POST', data: payload }),
      transformResponse: data<Deployment>,
      invalidatesTags: [{ type: 'Deployment', id: 'LIST' }],
    }),

    cancelDeployment: builder.mutation<Deployment, string>({
      query: (id) => ({ url: `deploymentAgent/deployments/${id}/cancel`, method: 'POST' }),
      transformResponse: data<Deployment>,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Deployment', id },
        { type: 'Deployment', id: 'LIST' },
      ],
    }),

    rollbackDeployment: builder.mutation<Deployment, { id: string; reason?: string; targetVersion?: string; confidenceScore?: number; riskLevel?: string }>({
      query: ({ id, ...body }) => ({ url: `deploymentAgent/deployments/${id}/rollback`, method: 'POST', data: body }),
      transformResponse: data<Deployment>,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Deployment', id },
        { type: 'Deployment', id: 'LIST' },
      ],
    }),

    getDeploymentLogs: builder.query<DeploymentLog[], { id: string; query?: DeploymentLogsQuery }>({
      query: ({ id, query }) => ({ url: `deploymentAgent/deployments/${id}/logs`, params: query }),
      transformResponse: data<DeploymentLog[]>,
      providesTags: (_result, _error, { id }) => [{ type: 'DeploymentLog', id }],
    }),

    getDeploymentVersions: builder.query<IVersionRecord[], string>({
      query: (id) => ({ url: `deploymentAgent/deployments/${id}/versions` }),
      transformResponse: data<IVersionRecord[]>,
      providesTags: (_result, _error, id) => [{ type: 'Deployment', id }],
    }),

    analyzeRollback: builder.mutation<RollbackAnalysis, { id: string; targetVersion?: string }>({
      query: ({ id, targetVersion }) => ({
        url: `deploymentAgent/deployments/${id}/analyze-rollback`,
        method: 'POST',
        data: { targetVersion },
      }),
      transformResponse: data<RollbackAnalysis>,
    }),

    getDeploymentRollbackHistory: builder.query<IRollbackRecord[], string>({
      query: (id) => ({ url: `deploymentAgent/deployments/${id}/rollback-history` }),
      transformResponse: data<IRollbackRecord[]>,
      providesTags: (_result, _error, id) => [{ type: 'Deployment', id }],
    }),

    getRollbackStats: builder.query<RollbackStats, void>({
      query: () => ({ url: 'deploymentAgent/deployments/dashboard/rollback-stats' }),
      transformResponse: data<RollbackStats>,
      providesTags: [{ type: 'Deployment', id: 'LIST' }],
    }),

    // ─── Predictive Intelligence ────────────────────────────────────────────

    predictDeployment: builder.mutation<DeploymentPrediction, PredictDeploymentPayload>({
      query: (payload) => ({ url: 'deploymentAgent/deployments/predict', method: 'POST', data: payload }),
      transformResponse: data<DeploymentPrediction>,
      invalidatesTags: [{ type: 'DeploymentPrediction', id: 'LIST' }],
    }),

    getDeploymentPredictions: builder.query<{ data: DeploymentPrediction[]; total: number }, PredictionsQuery>({
      query: (params) => ({ url: 'deploymentAgent/deployments/predictions', params }),
      transformResponse: (response: unknown) => ({
        data: readResponsePath<DeploymentPrediction[]>(response, 'data') ?? [],
        total: readResponsePath<number>(response, 'meta.total') ?? 0,
      }),
      providesTags: (result) =>
        result
          ? [
            ...result.data.map((p) => ({ type: 'DeploymentPrediction' as const, id: p._id })),
            { type: 'DeploymentPrediction' as const, id: 'LIST' },
          ]
          : [{ type: 'DeploymentPrediction' as const, id: 'LIST' }],
    }),

    getPredictionById: builder.query<DeploymentPrediction, string>({
      query: (id) => ({ url: `deploymentAgent/deployments/predictions/${id}` }),
      transformResponse: data<DeploymentPrediction>,
      providesTags: (_result, _error, id) => [{ type: 'DeploymentPrediction', id }],
    }),

    getDeploymentPrediction: builder.query<DeploymentPrediction | null, string>({
      query: (id) => ({ url: `deploymentAgent/deployments/${id}/prediction` }),
      transformResponse: data<DeploymentPrediction | null>,
      providesTags: (_result, _error, id) => [{ type: 'DeploymentPrediction', id: `deployment-${id}` }],
    }),

    getApplicationVersionHistory: builder.query<IVersionRecord[], string>({
      query: (applicationId) => ({
        url: 'deploymentAgent/deployments/application-versions',
        params: { applicationId },
      }),
      transformResponse: data<IVersionRecord[]>,
      providesTags: (_result, _error, applicationId) => [
        { type: 'Deployment' as const, id: `versions-${applicationId}` },
        { type: 'Deployment' as const, id: 'LIST' },
      ],
    }),

    rollbackToVersion: builder.mutation<Deployment, { targetDeploymentId: string; reason?: string; confidenceScore?: number; riskLevel?: string }>({
      query: ({ targetDeploymentId, ...body }) => ({
        url: `deploymentAgent/deployments/application-versions/${targetDeploymentId}/rollback`,
        method: 'POST',
        data: body,
      }),
      transformResponse: data<Deployment>,
      invalidatesTags: [{ type: 'Deployment', id: 'LIST' }],
    }),

    // ─── Reports ──────────────────────────────────────────────────────────────

    getReportDashboardStats: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/dashboard', params }),
      transformResponse: data<any>,
    }),

    getDeploymentsReport: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/deployments', params }),
      transformResponse: data<any>,
    }),

    getVersionsReport: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/versions', params }),
      transformResponse: data<any>,
    }),

    getServersReport: builder.query<any, void>({
      query: () => ({ url: 'deploymentAgent/deployments/reports/servers' }),
      transformResponse: data<any>,
    }),

    getHealthChecksReport: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/health-checks', params }),
      transformResponse: data<any>,
    }),

    getPm2Report: builder.query<any, { targetId: string }>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/pm2', params }),
      transformResponse: data<any>,
    }),

    getFailuresReport: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/failures', params }),
      transformResponse: data<any>,
    }),

    getUserActivityReport: builder.query<any, void>({
      query: () => ({ url: 'deploymentAgent/deployments/reports/users' }),
      transformResponse: data<any>,
    }),

    getAuditTrailReport: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/reports/audit-trail', params }),
      transformResponse: data<any>,
    }),

    getNotificationsReport: builder.query<any, any>({
      query: (params) => ({ url: 'deploymentAgent/deployments/notifications', params }),
      transformResponse: data<any>,
    }),
  }),
})

export const {
  useListCredentialsQuery,
  useGetCredentialsQuery,
  useCreateCredentialMutation,
  useUpdateCredentialMutation,
  useDeleteCredentialMutation,
  useBulkDeleteCredentialsMutation,
  useListDeploymentTargetsQuery,
  useGetDeploymentTargetsQuery,
  useCreateDeploymentTargetMutation,
  useUpdateDeploymentTargetMutation,
  useDeleteDeploymentTargetMutation,
  useBulkDeleteDeploymentTargetsMutation,
  useTestTargetConnectionMutation,
  useListApplicationsQuery,
  useGetApplicationsQuery,
  useCreateApplicationMutation,
  useUpdateApplicationMutation,
  useDeleteApplicationMutation,
  useBulkDeleteApplicationsMutation,
  useRotateWebhookSecretMutation,
  useUpdateAutoDeployMutation,
  useGetDeploymentsQuery,
  useGetDeploymentByIdQuery,
  useTriggerDeploymentMutation,
  useCancelDeploymentMutation,
  useRollbackDeploymentMutation,
  useGetDeploymentLogsQuery,
  useGetDeploymentVersionsQuery,
  useAnalyzeRollbackMutation,
  useGetDeploymentRollbackHistoryQuery,
  useGetRollbackStatsQuery,
  usePredictDeploymentMutation,
  useGetDeploymentPredictionsQuery,
  useGetPredictionByIdQuery,
  useGetDeploymentPredictionQuery,
  useGetApplicationVersionHistoryQuery,
  useRollbackToVersionMutation,
  useGetReportDashboardStatsQuery,
  useGetDeploymentsReportQuery,
  useGetVersionsReportQuery,
  useGetServersReportQuery,
  useGetHealthChecksReportQuery,
  useGetPm2ReportQuery,
  useGetFailuresReportQuery,
  useGetUserActivityReportQuery,
  useGetAuditTrailReportQuery,
  useGetNotificationsReportQuery,
} = deploymentAgentApi
