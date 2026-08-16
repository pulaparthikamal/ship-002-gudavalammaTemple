import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export interface AnalyticsDailyPoint {
  date: string
  totalPageviews: number
  uniqueSessions: number
}

export interface AnalyticsCountEntry {
  key: string
  count: number
}

export interface AnalyticsFunnelStep {
  stepIndex: number
  stepName: string
  count: number
}

export interface AnalyticsFunnel {
  funnelName: string
  steps: AnalyticsFunnelStep[]
}

export interface AnalyticsFeatureUsage {
  label: string
  count: number
  used: boolean
}

export interface AnalyticsSummary {
  dailyTrend: AnalyticsDailyPoint[]
  topPages: AnalyticsCountEntry[]
  topClicks: AnalyticsCountEntry[]
  funnels: AnalyticsFunnel[]
  featureUsage: AnalyticsFeatureUsage[]
}

export const analyticsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAnalyticsSummary: builder.query<AnalyticsSummary, { days: number }>({
      query: ({ days }) => ({ url: '/analytics/summary', method: 'GET', params: { days } }),
      transformResponse: (response: unknown) => readResponsePath<AnalyticsSummary>(response, 'summary'),
      providesTags: [{ type: 'AnalyticsSummary' as const, id: 'CURRENT' }],
    }),
    runAnalyticsRollup: builder.mutation<{ date: string }, { date?: string } | void>({
      query: (payload) => ({ url: '/analytics/rollup/run', method: 'POST', data: payload ?? {} }),
      transformResponse: (response: unknown) => readResponsePath<{ date: string }>(response, 'rollup'),
      invalidatesTags: [{ type: 'AnalyticsSummary' as const, id: 'CURRENT' }],
    }),
  }),
})

export const { useGetAnalyticsSummaryQuery, useRunAnalyticsRollupMutation } = analyticsApi
