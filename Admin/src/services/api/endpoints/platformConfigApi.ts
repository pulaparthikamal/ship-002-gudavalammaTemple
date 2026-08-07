import { apiSlice } from '@/services/api/apiSlice';

export interface PlatformConfig {
  _id: string;
  platform: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  isActive: boolean;
}

export interface PlatformConfigUpdatePayload {
  platform: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export const platformConfigApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPlatformConfigs: builder.query<{ success: boolean; data: PlatformConfig[] }, void>({
      query: () => ({
        url: '/platform-configs',
        method: 'GET',
      }),
      providesTags: ['Config'],
    }),
    updatePlatformConfig: builder.mutation<{ success: boolean; message: string; data: PlatformConfig }, PlatformConfigUpdatePayload>({
      query: (payload) => ({
        url: '/platform-configs',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['Config'],
    }),
    deletePlatformConfig: builder.mutation<{ success: boolean; message: string }, string>({
      query: (platform) => ({
        url: `/platform-configs/${platform}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Config'],
    }),
  }),
});

export const {
  useGetPlatformConfigsQuery,
  useUpdatePlatformConfigMutation,
  useDeletePlatformConfigMutation,
} = platformConfigApi;
