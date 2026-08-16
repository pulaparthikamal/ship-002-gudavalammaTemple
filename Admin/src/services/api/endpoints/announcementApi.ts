import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export type AnnouncementType = 'info' | 'urgent' | 'festival'
export type AnnouncementAudience = 'all' | 'devotee' | 'staff'

export interface Announcement {
  _id: string
  title: string
  body: string
  imageUrl?: string
  linkedEventId?: string
  type: AnnouncementType
  startAt: string
  endAt: string | null
  active: boolean
  targetAudience: AnnouncementAudience
  priority: number
}

export interface AnnouncementPayload {
  title: string
  body: string
  imageUrl?: string
  linkedEventId?: string
  type?: AnnouncementType
  startAt: string
  endAt?: string | null
  active?: boolean
  targetAudience?: AnnouncementAudience
  priority?: number
}

// Consumed by a later notification-popup phase; only the `active` feed needs no auth.
export const announcementApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getActiveAnnouncements: builder.query<Announcement[], void>({
      query: () => ({
        url: '/announcements/active',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Announcement[]>(response, 'announcements') ?? [],
    }),
    getAnnouncements: builder.query<Announcement[], void>({
      query: () => ({
        url: '/announcements',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Announcement[]>(response, 'announcements') ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((announcement) => ({ type: 'Announcement' as const, id: announcement._id })),
              { type: 'Announcement' as const, id: 'LIST' },
            ]
          : [{ type: 'Announcement' as const, id: 'LIST' }],
    }),
    createAnnouncement: builder.mutation<Announcement, AnnouncementPayload>({
      query: (payload) => ({
        url: '/announcements',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Announcement>(response, 'announcement'),
      invalidatesTags: [{ type: 'Announcement', id: 'LIST' }],
    }),
    updateAnnouncement: builder.mutation<Announcement, { id: EntityId; data: Partial<AnnouncementPayload> }>({
      query: ({ id, data }) => ({
        url: `/announcements/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Announcement>(response, 'announcement'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Announcement', id },
        { type: 'Announcement', id: 'LIST' },
      ],
    }),
    deleteAnnouncement: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/announcements/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Announcement', id },
        { type: 'Announcement', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetActiveAnnouncementsQuery,
  useGetAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
  useDeleteAnnouncementMutation,
} = announcementApi
