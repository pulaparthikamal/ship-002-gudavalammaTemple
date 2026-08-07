import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { encounterApiDetails } from '@/models/encounterModel'
import { normalizeCharge } from '@/services/api/endpoints/chargesApi'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  Encounter,
  EncounterAiSuggestionResult,
  EncounterAiSuggestions,
  EncounterCreatePayload,
  EncounterSuggestAiCodesPayload,
  EncounterUpdatePayload,
} from '@/types/encounter'
import type { EncounterCompleteResult } from '@/types/rcmWorkflow'

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

export function normalizePositiveNumberRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value)
    .map(([key, itemValue]) => [key.trim().toUpperCase(), itemValue] as const)
    .filter(([key, itemValue]) => key && typeof itemValue === 'number' && Number.isFinite(itemValue) && itemValue > 0)

  return entries.length ? Object.fromEntries(entries) : undefined
}

function normalizeAiSuggestedCode(response: unknown) {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>
  const code = normalizeOptionalString(item.code)

  if (!code) {
    return null
  }

  return {
    code,
    description: normalizeString(item.description),
    confidence: typeof item.confidence === 'number' ? item.confidence : 0,
    reasoning: normalizeString(item.reasoning),
    units: normalizeOptionalNumber(item.units),
  }
}

function normalizeAiSuggestedCodeList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => normalizeAiSuggestedCode(item))
        .filter((item): item is NonNullable<ReturnType<typeof normalizeAiSuggestedCode>> => Boolean(item))
    : []
}

function normalizeEncounterAiSuggestions(response: unknown): EncounterAiSuggestions | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  return {
    status: normalizeString(item.status),
    summary: normalizeOptionalString(item.summary),
    diagnosisCodes: normalizeAiSuggestedCodeList(item.diagnosisCodes),
    procedureCodes: normalizeAiSuggestedCodeList(item.procedureCodes),
    suggestedFixes: normalizeStringArray(item.suggestedFixes),
    appliedDiagnosisCodes: normalizeStringArray(item.appliedDiagnosisCodes),
    appliedProcedureCodes: normalizeStringArray(item.appliedProcedureCodes),
    applySuggestions: Boolean(item.applySuggestions),
    replaceExistingCodes: Boolean(item.replaceExistingCodes),
  }
}

function readFirstResponsePath<T>(response: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readResponsePath<T | undefined>(response, path)

    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

export function normalizeEncounter(response: unknown): Encounter | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  const vitals = typeof item.vitals === 'object' && item.vitals !== null ? (item.vitals as Record<string, unknown>) : {}
  const checkout = typeof item.checkout === 'object' && item.checkout !== null ? (item.checkout as Record<string, unknown>) : {}
  const estimate = typeof item.estimate === 'object' && item.estimate !== null ? (item.estimate as Record<string, unknown>) : null

  return {
    _id: item._id,
    encounterId:
      typeof item.encounterId === 'string'
        ? item.encounterId
        : typeof item.encounterId === 'object' && item.encounterId !== null && '_id' in item.encounterId
          ? String((item.encounterId as { _id?: string })._id ?? '')
          : '',
    appointmentId: normalizeOptionalString(item.appointmentId),
    patientId: normalizeOptionalString(item.patientId),
    providerId: normalizeOptionalString(item.providerId),
    renderingProviderId: normalizeOptionalString(item.renderingProviderId),
    supervisingProviderId: normalizeOptionalString(item.supervisingProviderId),
    facilityId: normalizeOptionalString(item.facilityId),
    encounterDate: normalizeDateString(item.encounterDate),
    startTime: normalizeDateString(item.startTime),
    endTime: normalizeDateString(item.endTime),
    visitStatus: normalizeOptionalString(item.visitStatus),
    chiefComplaint: normalizeOptionalString(item.chiefComplaint),
    historyOfPresentIllness: normalizeOptionalString(item.historyOfPresentIllness),
    clinicalNotes: normalizeOptionalString(item.clinicalNotes),
    diagnosisCodes: normalizeStringArray(item.diagnosisCodes),
    procedureCodes: normalizeStringArray(item.procedureCodes),
    procedureCodeUnits: normalizePositiveNumberRecord(item.procedureCodeUnits),
    vitals: {
      temperature: normalizeOptionalNumber(vitals.temperature),
      bloodPressure: normalizeOptionalString(vitals.bloodPressure),
      pulse: normalizeOptionalNumber(vitals.pulse),
      height: normalizeOptionalNumber(vitals.height),
      weight: normalizeOptionalNumber(vitals.weight),
      bmi: normalizeOptionalNumber(vitals.bmi),
    },
    checkout: {
      checkOutTime: normalizeDateString(checkout.checkOutTime),
      followUpRequired: Boolean(checkout.followUpRequired),
      balanceDue: normalizeOptionalNumber(checkout.balanceDue),
      followUpInstructions: normalizeOptionalString(checkout.followUpInstructions),
    },
    estimate: estimate
      ? {
          estimatedPatientResponsibility: normalizeOptionalNumber(estimate.estimatedPatientResponsibility),
          estimatedInsurancePayment: normalizeOptionalNumber(estimate.estimatedInsurancePayment),
          estimatedAllowedAmount: normalizeOptionalNumber(estimate.estimatedAllowedAmount),
          lastEstimatedAt: normalizeDateString(estimate.lastEstimatedAt),
        }
      : undefined,
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

const encounterListDataPaths = [encounterApiDetails.responseDataPath, 'data.data', 'items']
const encounterListTotalPaths = [
  encounterApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeEncounterListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Encounter> {
  return normalizeCrudListResponse<unknown, Encounter>({
    response,
    query,
    dataPaths: encounterListDataPaths,
    totalPaths: encounterListTotalPaths,
    mapItem: normalizeEncounter,
  })
}

export const encountersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEncounters: builder.query<CrudListResponse<Encounter>, CrudListQuery>({
      query: (query) => ({
        url: encounterApiDetails.endpoint,
        method: 'GET',
        params: {
          [encounterApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeEncounterListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Encounter' as const, id: item._id })),
              { type: 'Encounter' as const, id: 'LIST' },
            ]
          : [{ type: 'Encounter' as const, id: 'LIST' }],
    }),
    getEncounter: builder.query<Encounter, EntityId>({
      query: (id) => ({
        url: `${encounterApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEncounter(readResponsePath<unknown>(response, encounterApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Encounter response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Encounter', id }],
    }),
    createEncounter: builder.mutation<Encounter, EncounterCreatePayload>({
      query: (payload) => ({
        url: encounterApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEncounter(readResponsePath<unknown>(response, encounterApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Encounter response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Encounter', id: 'LIST' }],
    }),
    updateEncounter: builder.mutation<Encounter, { id: EntityId; data: EncounterUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${encounterApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEncounter(readResponsePath<unknown>(response, encounterApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Encounter response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Encounter', id },
        { type: 'Encounter', id: 'LIST' },
      ],
    }),
    deleteEncounter: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${encounterApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Encounter', id },
        { type: 'Encounter', id: 'LIST' },
      ],
    }),
    bulkDeleteEncounters: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${encounterApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Encounter' as const, id })),
        { type: 'Encounter' as const, id: 'LIST' },
      ],
    }),
    completeEncounter: builder.mutation<EncounterCompleteResult, EntityId>({
      query: (id) => ({
        url: `${encounterApiDetails.endpoint}/${id}/complete`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown) => {
        const encounter = normalizeEncounter(readResponsePath<unknown>(response, 'data.encounter'))
        const charge = normalizeCharge(readResponsePath<unknown>(response, 'data.charge'))

        if (!encounter || !charge) {
          throw new Error('Encounter completion response is invalid.')
        }

        return {
          encounter,
          charge,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Encounter', id },
        { type: 'Encounter', id: 'LIST' },
        { type: 'Charge', id: 'LIST' },
        { type: 'Appointment', id: 'LIST' },
      ],
    }),
    suggestEncounterAiCodes: builder.mutation<
      EncounterAiSuggestionResult,
      { id: EntityId; data?: EncounterSuggestAiCodesPayload }
    >({
      query: ({ id, data }) => ({
        url: `${encounterApiDetails.endpoint}/${id}/ai-code-suggestions`,
        method: 'POST',
        data,
        timeout: 300_000,
      }),
      transformResponse: (response: unknown) => {
        const encounter = normalizeEncounter(readFirstResponsePath<unknown>(response, ['data.encounter', 'encounter']))
        const suggestions = normalizeEncounterAiSuggestions(readFirstResponsePath<unknown>(response, ['data.suggestions', 'suggestions']))

        if (!encounter || !suggestions) {
          throw new Error('Encounter AI suggestion response is invalid.')
        }

        return {
          encounter,
          suggestions,
        }
      },
      invalidatesTags: (result, _error, { id }) =>
        result?.suggestions.applySuggestions
          ? [
              { type: 'Encounter', id },
              { type: 'Encounter', id: 'LIST' },
            ]
          : [],
    }),
  }),
})

export const {
  useBulkDeleteEncountersMutation,
  useCompleteEncounterMutation,
  useCreateEncounterMutation,
  useDeleteEncounterMutation,
  useGetEncounterQuery,
  useGetEncountersQuery,
  useSuggestEncounterAiCodesMutation,
  useUpdateEncounterMutation,
} = encountersApi
