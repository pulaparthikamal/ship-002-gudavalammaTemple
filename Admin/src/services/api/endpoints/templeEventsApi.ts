import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export interface TempleEvent {
  _id: string
  name: string
  description: string
  imageUrl?: string
  startDate: string
  endDate?: string
  registrationRequired: boolean
  capacity?: number
  registrationDeadline?: string
  active: boolean
}

export interface TempleEventPayload {
  name: string
  description?: string
  imageUrl?: string
  startDate: string
  endDate?: string
  registrationRequired?: boolean
  capacity?: number
  registrationDeadline?: string
  active?: boolean
}

export interface EventRegistration {
  _id: string
  event: TempleEvent | string
  devotee?: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  status: 'confirmed' | 'cancelled'
  registeredAt: string
}

export interface CreateEventRegistrationPayload {
  eventId: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

export const templeEventsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTempleEvents: builder.query<TempleEvent[], void>({
      query: () => ({ url: '/temple-events', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<TempleEvent[]>(response, 'templeEvents') ?? [],
      providesTags: [{ type: 'TempleEvent' as const, id: 'LIST' }],
    }),
    createTempleEvent: builder.mutation<TempleEvent, TempleEventPayload>({
      query: (payload) => ({ url: '/temple-events', method: 'POST', data: payload }),
      transformResponse: (response: unknown) => readResponsePath<TempleEvent>(response, 'templeEvent'),
      invalidatesTags: [{ type: 'TempleEvent' as const, id: 'LIST' }],
    }),
    updateTempleEvent: builder.mutation<TempleEvent, { id: EntityId; data: Partial<TempleEventPayload> }>({
      query: ({ id, data }) => ({ url: `/temple-events/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => readResponsePath<TempleEvent>(response, 'templeEvent'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'TempleEvent' as const, id },
        { type: 'TempleEvent' as const, id: 'LIST' },
      ],
    }),
    deleteTempleEvent: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `/temple-events/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'TempleEvent' as const, id },
        { type: 'TempleEvent' as const, id: 'LIST' },
      ],
    }),
    getEventRegistrations: builder.query<EventRegistration[], EntityId>({
      query: (eventId) => ({ url: `/temple-events/${eventId}/registrations`, method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<EventRegistration[]>(response, 'registrations') ?? [],
      providesTags: (_result, _error, eventId) => [{ type: 'EventRegistration' as const, id: eventId }],
    }),
    getMyEventRegistrations: builder.query<EventRegistration[], void>({
      query: () => ({ url: '/event-registrations/mine', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<EventRegistration[]>(response, 'registrations') ?? [],
      providesTags: [{ type: 'EventRegistration' as const, id: 'MINE' }],
    }),
    registerForEvent: builder.mutation<EventRegistration, CreateEventRegistrationPayload>({
      query: (payload) => ({ url: '/event-registrations', method: 'POST', data: payload }),
      transformResponse: (response: unknown) => readResponsePath<EventRegistration>(response, 'registration'),
      invalidatesTags: [{ type: 'EventRegistration' as const, id: 'MINE' }],
    }),
  }),
})

export const {
  useGetTempleEventsQuery,
  useCreateTempleEventMutation,
  useUpdateTempleEventMutation,
  useDeleteTempleEventMutation,
  useGetEventRegistrationsQuery,
  useGetMyEventRegistrationsQuery,
  useRegisterForEventMutation,
} = templeEventsApi
