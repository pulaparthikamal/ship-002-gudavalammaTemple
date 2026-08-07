import { apiSlice } from '../apiSlice'
import type { SocialCategory, SocialAutomation, SocialAccount, SocialPost } from '@/types/social'
import { readResponsePath } from '@/services/api/responseTransform'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { EntityId } from '@/types/common'
import { AUTH_BASE_URL } from '../apiConfig'

export const socialApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Categories
    getSocialCategories: builder.query<CrudListResponse<SocialCategory>, CrudListQuery>({
      query: (query) => ({ url: '/social/categories', params: { filter: JSON.stringify(query) } }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse<SocialCategory>({
          response,
          query,
          dataPaths: ['data', 'data.data'],
          totalPaths: ['meta.total', 'data.total'],
        }),
      providesTags: ['SocialCategory'],
    }),
    createSocialCategory: builder.mutation<SocialCategory, Partial<SocialCategory>>({
      query: (data) => ({ url: '/social/categories', method: 'POST', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialCategory>(response, 'data'),
      invalidatesTags: ['SocialCategory'],
    }),
    updateSocialCategory: builder.mutation<SocialCategory, { id: EntityId; data: Partial<SocialCategory> }>({
      query: ({ id, data }) => ({ url: `/social/categories/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialCategory>(response, 'data'),
      invalidatesTags: ['SocialCategory'],
    }),
    deleteSocialCategory: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `/social/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SocialCategory'],
    }),
    getSocialAudienceSuggestions: builder.query<string[], void>({
      query: () => ({ url: '/social/categories/audience-suggestions' }),
      transformResponse: (response: unknown) => readResponsePath<string[]>(response, 'data') || [],
      providesTags: ['SocialCategory'],
    }),
    deleteSocialAudienceSuggestion: builder.mutation<void, string>({
      query: (value) => ({ url: `/social/categories/audience-suggestions/${encodeURIComponent(value)}`, method: 'DELETE' }),
      invalidatesTags: ['SocialCategory'],
    }),


    // Automations
    getSocialAutomations: builder.query<CrudListResponse<SocialAutomation>, CrudListQuery>({
      query: (query) => ({ url: '/social/automation', params: { filter: JSON.stringify(query) } }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse<SocialAutomation>({
          response,
          query,
          dataPaths: ['data', 'data.data'],
          totalPaths: ['meta.total', 'data.total'],
        }),
      providesTags: ['SocialAutomation'],
    }),
    createSocialAutomation: builder.mutation<SocialAutomation, Partial<SocialAutomation>>({
      query: (data) => ({ url: '/social/automation', method: 'POST', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialAutomation>(response, 'data'),
      invalidatesTags: ['SocialAutomation', 'SocialCategory'],
    }),
    updateSocialAutomation: builder.mutation<SocialAutomation, { id: EntityId; data: Partial<SocialAutomation> }>({
      query: ({ id, data }) => ({ url: `/social/automation/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialAutomation>(response, 'data'),
      invalidatesTags: ['SocialAutomation', 'SocialCategory'],
    }),
    deleteSocialAutomation: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `/social/automation/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SocialAutomation'],
    }),
    toggleSocialAutomationPause: builder.mutation<SocialAutomation, EntityId>({
      query: (id) => ({ url: `/social/automation/${id}/toggle-pause`, method: 'PUT' }),
      transformResponse: (response: unknown) => readResponsePath<SocialAutomation>(response, 'data'),
      invalidatesTags: ['SocialAutomation', 'SocialPost'],
    }),


    // Accounts
    getSocialAccounts: builder.query<CrudListResponse<SocialAccount>, CrudListQuery>({
      query: (query) => ({ url: '/social/accounts', params: { filter: JSON.stringify(query) } }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse<SocialAccount>({
          response,
          query,
          dataPaths: ['data', 'data.data'],
          totalPaths: ['meta.total', 'data.total'],
        }),
      providesTags: ['SocialAccount'],
    }),
    connectSocialAccount: builder.mutation<SocialAccount, { platform: string; data: any }>({
      query: ({ platform, data }) => ({ url: `/social/connect/${platform}`, method: 'POST', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialAccount>(response, 'data'),
      invalidatesTags: ['SocialAccount'],
    }),
    disconnectSocialAccount: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `/social/accounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SocialAccount'],
    }),
    updateSocialAccount: builder.mutation<SocialAccount, { id: EntityId; data: Partial<SocialAccount> }>({
      query: ({ id, data }) => ({ url: `/social/accounts/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialAccount>(response, 'data'),
      invalidatesTags: ['SocialAccount'],
    }),


    // Posts
    getSocialPosts: builder.query<CrudListResponse<SocialPost>, CrudListQuery>({
      query: (query) => ({ url: '/social/posts', params: { filter: JSON.stringify(query) } }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse<SocialPost>({
          response,
          query,
          dataPaths: ['data', 'data.data'],
          totalPaths: ['meta.total', 'data.total'],
        }),
      providesTags: ['SocialPost'],
    }),
    getScheduledPosts: builder.query<CrudListResponse<SocialPost>, CrudListQuery>({
      query: (query) => ({ url: '/social/posts/scheduled', params: { filter: JSON.stringify(query) } }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse<SocialPost>({
          response,
          query,
          dataPaths: ['data', 'data.data'],
          totalPaths: ['meta.total', 'data.total'],
        }),
      providesTags: ['SocialPost'],
    }),
    getPostedPosts: builder.query<CrudListResponse<SocialPost>, CrudListQuery>({
      query: (query) => ({ url: '/social/posts/posted', params: { filter: JSON.stringify(query) } }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse<SocialPost>({
          response,
          query,
          dataPaths: ['data', 'data.data'],
          totalPaths: ['meta.total', 'data.total'],
        }),
      providesTags: ['SocialPost'],
    }),
    createSocialPost: builder.mutation<SocialPost, Partial<SocialPost>>({
      query: (data) => ({ url: '/social/posts', method: 'POST', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialPost>(response, 'data'),
      invalidatesTags: ['SocialPost', 'SocialCategory'],
    }),
    updateSocialPost: builder.mutation<SocialPost, { id: EntityId; data: Partial<SocialPost> }>({
      query: ({ id, data }) => ({ url: `/social/posts/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => readResponsePath<SocialPost>(response, 'data'),
      invalidatesTags: ['SocialPost', 'SocialCategory'],
    }),
    deleteSocialPost: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `/social/posts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SocialPost'],
    }),
    bulkDeleteSocialPosts: builder.mutation<any, { ids: EntityId[] }>({
      query: (data) => ({ url: `/social/posts/bulk-delete`, method: 'POST', data }),
      invalidatesTags: ['SocialPost'],
    }),
    sendSocialPostNow: builder.mutation<SocialPost, { id: EntityId; pageId?: string; platform?: string }>(
      { query: ({ id, pageId, platform }) => ({ url: `/social/posts/${id}/send-now`, method: 'POST', data: { pageId, platform } }),
        transformResponse: (response: unknown) => readResponsePath<SocialPost>(response, 'data'),
        invalidatesTags: ['SocialPost'],
      }),
    sendSocialPostApprovalEmail: builder.mutation<SocialPost, EntityId>({
      query: (id) => ({ url: `/social/posts/${id}/send-approval-email`, method: 'POST' }),
      transformResponse: (response: unknown) => readResponsePath<SocialPost>(response, 'data'),
      invalidatesTags: ['SocialPost'],
    }),
    generatePostContent: builder.mutation<any, { category: string; interests: string[]; tone: string; targetAudience?: string; userId?: string }>({
      query: (data) => ({ url: '/social/generate', method: 'POST', data }),
    }),
    humanizeContent: builder.mutation<any, { content: string }>({
      query: (data) => ({ url: '/social/humanize', method: 'POST', data }),
    }),
    getFacebookPages: builder.query<any, string>({
      // Backend registers this at /auth/facebook (no /api/v1 prefix) — use absolute URL
      query: (userId) => ({ url: `${AUTH_BASE_URL}/auth/facebook/pages?userId=${userId}` }),
    }),
    setActiveFacebookPage: builder.mutation<any, { userId: string; pageId: string }>({
      query: (data) => ({ url: `${AUTH_BASE_URL}/auth/facebook/pages/active`, method: 'POST', data }),
      invalidatesTags: ['SocialAccount'],
    }),
    bulkApprovePosts: builder.mutation<any, { ids: string[] }>({
      query: (data) => ({ url: '/social/posts/bulk-approve', method: 'POST', data }),
      invalidatesTags: ['SocialPost'],
    }),
    bulkRejectPosts: builder.mutation<any, { ids: string[]; reason?: string }>({
      query: (data) => ({ url: '/social/posts/bulk-reject', method: 'POST', data }),
      invalidatesTags: ['SocialPost'],
    }),
  }),
})

export const {
  useGetSocialCategoriesQuery,
  useCreateSocialCategoryMutation,
  useUpdateSocialCategoryMutation,
  useDeleteSocialCategoryMutation,
  useGetSocialAudienceSuggestionsQuery,
  useDeleteSocialAudienceSuggestionMutation,
  useGetSocialAutomationsQuery,
  useCreateSocialAutomationMutation,
  useUpdateSocialAutomationMutation,
  useDeleteSocialAutomationMutation,
  useToggleSocialAutomationPauseMutation,
  useGetSocialAccountsQuery,
  useConnectSocialAccountMutation,
  useDisconnectSocialAccountMutation,
  useUpdateSocialAccountMutation,
  useGetSocialPostsQuery,
  useGetScheduledPostsQuery,
  useGetPostedPostsQuery,
  useCreateSocialPostMutation,
  useUpdateSocialPostMutation,
  useDeleteSocialPostMutation,
  useBulkDeleteSocialPostsMutation,
  useSendSocialPostNowMutation,
  useSendSocialPostApprovalEmailMutation,
  useGeneratePostContentMutation,
  useHumanizeContentMutation,
  useGetFacebookPagesQuery,
  useSetActiveFacebookPageMutation,
  useBulkApprovePostsMutation,
  useBulkRejectPostsMutation,
} = socialApi
