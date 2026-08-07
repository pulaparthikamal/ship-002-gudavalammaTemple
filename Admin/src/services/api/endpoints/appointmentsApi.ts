import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { appointmentApiDetails } from '@/models/appointmentModel'
import { normalizeEncounter } from '@/services/api/endpoints/encountersApi'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Appointment, AppointmentCreatePayload, AppointmentUpdatePayload } from '@/types/appointment'
import type { AppointmentCheckInResult } from '@/types/rcmWorkflow'

export interface AppointmentSummary {
  awaitingArrival: number
  inClinic: number
  completed: number
  exceptions: number
  financialHold: number
}

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function normalizeNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
}

export function normalizeAppointment(response: unknown): Appointment | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  const referral = typeof item.referral === 'object' && item.referral !== null ? (item.referral as Record<string, unknown>) : {}
  const estimate = typeof item.estimate === 'object' && item.estimate !== null ? (item.estimate as Record<string, unknown>) : {}

  return {
    _id: item._id,
    appointmentId:
      typeof item.appointmentId === 'string'
        ? item.appointmentId
        : typeof item.appointmentId === 'object' && item.appointmentId !== null && '_id' in item.appointmentId
          ? String((item.appointmentId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    providerId: normalizeOptionalString(item.providerId),
    facilityId: normalizeOptionalString(item.facilityId),
    appointmentDate: normalizeDateString(item.appointmentDate),
    appointmentTime: normalizeOptionalString(item.appointmentTime),
    appointmentStart: normalizeDateString(item.appointmentStart),
    appointmentType: normalizeOptionalString(item.appointmentType),
    visitType: normalizeOptionalString(item.visitType),
    reason: normalizeOptionalString(item.reason),
    appointmentStatus: normalizeOptionalString(item.appointmentStatus),
    checkInStatus: normalizeOptionalString(item.checkInStatus),
    checkInTime: normalizeDateString(item.checkInTime),
    checkOutTime: normalizeDateString(item.checkOutTime),
    noShowFlag: Boolean(item.noShowFlag),
    cancellationReason: normalizeOptionalString(item.cancellationReason),
    notes: normalizeOptionalString(item.notes),
    referral: {
      required: Boolean(referral.required),
      referralNumber: normalizeOptionalString(referral.referralNumber),
      validFrom: normalizeDateString(referral.validFrom),
      validTo: normalizeDateString(referral.validTo),
    },
    estimate: {
      estimatedPatientResponsibility: normalizeOptionalNumber(estimate.estimatedPatientResponsibility),
      depositAmount: normalizeOptionalNumber(estimate.depositAmount),
      depositCollected: Boolean(estimate.depositCollected),
    },
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt:
      normalizeDateString(item.createdAt) ??
      normalizeDateString(item.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(item.updatedAt) ??
      normalizeDateString(item.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const appointmentListDataPaths = [appointmentApiDetails.responseDataPath, 'data.data', 'items']
const appointmentListTotalPaths = [
  appointmentApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeAppointmentListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Appointment> {
  return normalizeCrudListResponse<unknown, Appointment>({
    response,
    query,
    dataPaths: appointmentListDataPaths,
    totalPaths: appointmentListTotalPaths,
    mapItem: normalizeAppointment,
  })
}

export const appointmentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAppointments: builder.query<CrudListResponse<Appointment>, CrudListQuery>({
      query: (query) => ({
        url: appointmentApiDetails.endpoint,
        method: 'GET',
        params: {
          [appointmentApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeAppointmentListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Appointment' as const, id: item._id })),
              { type: 'Appointment' as const, id: 'LIST' },
            ]
          : [{ type: 'Appointment' as const, id: 'LIST' }],
    }),
    getAppointmentSummary: builder.query<AppointmentSummary, CrudListQuery>({
      query: (query) => ({
        url: `${appointmentApiDetails.endpoint}/summary`,
        method: 'GET',
        params: {
          [appointmentApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown) => {
        const summary = readResponsePath<unknown>(response, appointmentApiDetails.responseDataPath)

        if (typeof summary !== 'object' || summary === null) {
          throw new Error('Appointment summary response is invalid.')
        }

        const record = summary as Record<string, unknown>

        return {
          awaitingArrival: normalizeOptionalNumber(record.awaitingArrival) ?? 0,
          inClinic: normalizeOptionalNumber(record.inClinic) ?? 0,
          completed: normalizeOptionalNumber(record.completed) ?? 0,
          exceptions: normalizeOptionalNumber(record.exceptions) ?? 0,
          financialHold: normalizeOptionalNumber(record.financialHold) ?? 0,
        }
      },
      providesTags: [{ type: 'Appointment', id: 'LIST' }],
    }),
    getAppointment: builder.query<Appointment, EntityId>({
      query: (id) => ({
        url: `${appointmentApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppointment(readResponsePath<unknown>(response, appointmentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Appointment response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Appointment', id }],
    }),
    createAppointment: builder.mutation<Appointment, AppointmentCreatePayload>({
      query: (payload) => ({
        url: appointmentApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppointment(readResponsePath<unknown>(response, appointmentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Appointment response is invalid.')
        }

        return item
      },
      invalidatesTags: [
        { type: 'Appointment', id: 'LIST' },
        { type: 'EligibilityVerification', id: 'LIST' },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
    updateAppointment: builder.mutation<Appointment, { id: EntityId; data: AppointmentUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${appointmentApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppointment(readResponsePath<unknown>(response, appointmentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Appointment response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Appointment', id },
        { type: 'Appointment', id: 'LIST' },
      ],
    }),
    deleteAppointment: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${appointmentApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Appointment', id },
        { type: 'Appointment', id: 'LIST' },
      ],
    }),
    bulkDeleteAppointments: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${appointmentApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Appointment' as const, id })),
        { type: 'Appointment' as const, id: 'LIST' },
      ],
    }),
    checkInAppointment: builder.mutation<AppointmentCheckInResult, EntityId>({
      query: (id) => ({
        url: `${appointmentApiDetails.endpoint}/${id}/check-in`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown) => {
        const appointment = normalizeAppointment(readResponsePath<unknown>(response, 'data.appointment'))
        const encounter = normalizeEncounter(readResponsePath<unknown>(response, 'data.encounter'))

        if (!appointment || !encounter) {
          throw new Error('Appointment check-in response is invalid.')
        }

        return {
          appointment,
          encounter,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Appointment', id },
        { type: 'Appointment', id: 'LIST' },
        { type: 'Encounter', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteAppointmentsMutation,
  useCheckInAppointmentMutation,
  useCreateAppointmentMutation,
  useGetAppointmentSummaryQuery,
  useDeleteAppointmentMutation,
  useGetAppointmentQuery,
  useGetAppointmentsQuery,
  useUpdateAppointmentMutation,
} = appointmentsApi
