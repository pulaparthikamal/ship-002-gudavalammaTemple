import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { patientApiDetails } from '@/models/patientModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Patient, PatientCreatePayload, PatientUpdatePayload } from '@/types/patient'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeIdString(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const objectId = (value as { _id?: unknown })._id
    return typeof objectId === 'string' ? objectId : undefined
  }

  return undefined
}

function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeAttachmentLinks(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          documentType: normalizeOptionalString(item.documentType),
          title: normalizeOptionalString(item.title),
          fileUrl: normalizeOptionalString(item.fileUrl),
          description: normalizeOptionalString(item.description),
        }))
    : []
}

function normalizePatient(response: unknown): Patient | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const patient = response as Record<string, unknown>
  const patientId = normalizeIdString(patient._id)

  if (!patientId) {
    return null
  }

  const address =
    typeof patient.address === 'object' && patient.address !== null
      ? (patient.address as Record<string, unknown>)
      : {}
  const guarantor =
    typeof patient.guarantor === 'object' && patient.guarantor !== null
      ? (patient.guarantor as Record<string, unknown>)
      : {}

  return {
    _id: patientId,
    patientId:
      normalizeIdString(patient.patientId) ??
      patientId,
    medicalRecordNumber:
      normalizeString(
        patient.medicalRecordNumber ??
        patient.mrn ??
        patient.MRN ??
        patient.medicalRecordNo ??
        patient.medical_record_number,
      ),
    firstName: normalizeString(patient.firstName),
    middleName: normalizeOptionalString(patient.middleName),
    lastName: normalizeString(patient.lastName),
    suffix: normalizeOptionalString(patient.suffix),
    dateOfBirth: normalizeDateString(patient.dateOfBirth) ?? '',
    gender: normalizeString(patient.gender),
    sex: normalizeOptionalString(patient.sex),
    maritalStatus: normalizeOptionalString(patient.maritalStatus),
    mobileNumber: normalizeOptionalString(patient.mobileNumber),
    alternatePhoneNumber:
      normalizeOptionalString(patient.alternatePhoneNumber),
    email: normalizeOptionalString(patient.email),
    preferredLanguage: normalizeOptionalString(patient.preferredLanguage),
    interpreterRequired: Boolean(patient.interpreterRequired),
    race: normalizeOptionalString(patient.race),
    ethnicity: normalizeOptionalString(patient.ethnicity),
    patientStatus: typeof patient.patientStatus === 'string' ? patient.patientStatus : 'Active',
    ssnLast4: normalizeOptionalString(patient.ssnLast4),
    employmentStatus: normalizeOptionalString(patient.employmentStatus),
    employerName: normalizeOptionalString(patient.employerName),
    preferredCommunicationMethod: normalizeOptionalString(patient.preferredCommunicationMethod),
    deceased: Boolean(patient.deceased),
    dateOfDeath: normalizeDateString(patient.dateOfDeath) ?? null,
    consentToText: Boolean(patient.consentToText),
    consentToCall: Boolean(patient.consentToCall),
    consentToEmail: Boolean(patient.consentToEmail),
    hipaaConsentSigned: Boolean(patient.hipaaConsentSigned),
    financialConsentSigned: Boolean(patient.financialConsentSigned),
    address: {
      addressLine1: normalizeOptionalString(address.addressLine1),
      addressLine2: normalizeOptionalString(address.addressLine2),
      city: normalizeOptionalString(address.city),
      state: normalizeOptionalString(address.state),
      zipCode: normalizeOptionalString(address.zipCode),
      country: normalizeOptionalString(address.country),
    },
    guarantor: {
      firstName: normalizeOptionalString(guarantor.firstName),
      lastName: normalizeOptionalString(guarantor.lastName),
      relationshipToPatient: normalizeOptionalString(guarantor.relationshipToPatient),
      phone: normalizeOptionalString(guarantor.phone),
      email: normalizeOptionalString(guarantor.email),
      addressLine1: normalizeOptionalString(guarantor.addressLine1),
      addressLine2: normalizeOptionalString(guarantor.addressLine2),
      city: normalizeOptionalString(guarantor.city),
      state: normalizeOptionalString(guarantor.state),
      zipCode: normalizeOptionalString(guarantor.zipCode),
    },
    emergencyContacts: Array.isArray(patient.emergencyContacts)
      ? patient.emergencyContacts
          .filter((contact): contact is Record<string, unknown> => typeof contact === 'object' && contact !== null)
          .map((contact) => ({
            firstName: normalizeOptionalString(contact.firstName),
            lastName: normalizeOptionalString(contact.lastName),
            relationship: normalizeOptionalString(contact.relationship),
            phone: normalizeOptionalString(contact.phone),
            email: normalizeOptionalString(contact.email),
          }))
      : [],
    attachments: normalizeAttachmentLinks(patient.attachments),
    duplicateCheckFlag: Boolean(patient.duplicateCheckFlag),
    mergeRequiredFlag: Boolean(patient.mergeRequiredFlag),
    duplicateOfPatientId: normalizeIdString(patient.duplicateOfPatientId),
    mergedIntoPatientId: normalizeIdString(patient.mergedIntoPatientId),
    mergedAt: normalizeDateString(patient.mergedAt) ?? null,
    mergeNotes: normalizeOptionalString(patient.mergeNotes),
    active: typeof patient.active === 'boolean' ? patient.active : true,
    createdAt:
      normalizeDateString(patient.createdAt) ??
      normalizeDateString(patient.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(patient.updatedAt) ??
      normalizeDateString(patient.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(patient.createdBy),
    updatedBy: normalizeOptionalString(patient.updatedBy),
    isDeleted: typeof patient.isDeleted === 'boolean' ? patient.isDeleted : undefined,
    deletedAt: normalizeDateString(patient.deletedAt),
    __v: typeof patient.__v === 'number' ? patient.__v : undefined,
  }
}

const patientListDataPaths = [patientApiDetails.responseDataPath, 'data.data', 'items']
const patientListTotalPaths = [
  patientApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePatientListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Patient> {
  return normalizeCrudListResponse<unknown, Patient>({
    response,
    query,
    dataPaths: patientListDataPaths,
    totalPaths: patientListTotalPaths,
    mapItem: normalizePatient,
  })
}

export const patientsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPatients: builder.query<CrudListResponse<Patient>, CrudListQuery>({
      query: (query) => ({
        url: patientApiDetails.endpoint,
        method: 'GET',
        params: {
          [patientApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizePatientListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((patient) => ({ type: 'Patient' as const, id: patient._id })),
              { type: 'Patient' as const, id: 'LIST' },
            ]
          : [{ type: 'Patient' as const, id: 'LIST' }],
    }),
    getPatient: builder.query<Patient, EntityId>({
      query: (id) => ({
        url: `${patientApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const patient = normalizePatient(readResponsePath<unknown>(response, patientApiDetails.responseDataPath))

        if (!patient) {
          throw new Error('Patient response is invalid.')
        }

        return patient
      },
      providesTags: (_result, _error, id) => [{ type: 'Patient', id }],
    }),
    createPatient: builder.mutation<Patient, PatientCreatePayload>({
      query: (payload) => ({
        url: patientApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const patient = normalizePatient(readResponsePath<unknown>(response, patientApiDetails.responseDataPath))

        if (!patient) {
          throw new Error('Patient response is invalid.')
        }

        return patient
      },
      invalidatesTags: [{ type: 'Patient', id: 'LIST' }],
    }),
    updatePatient: builder.mutation<Patient, { id: EntityId; data: PatientUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${patientApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const patient = normalizePatient(readResponsePath<unknown>(response, patientApiDetails.responseDataPath))

        if (!patient) {
          throw new Error('Patient response is invalid.')
        }

        return patient
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Patient', id },
        { type: 'Patient', id: 'LIST' },
      ],
    }),
    deletePatient: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${patientApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Patient', id },
        { type: 'Patient', id: 'LIST' },
      ],
    }),
    bulkDeletePatients: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${patientApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Patient' as const, id })),
        { type: 'Patient' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeletePatientsMutation,
  useCreatePatientMutation,
  useDeletePatientMutation,
  useGetPatientQuery,
  useGetPatientsQuery,
  useUpdatePatientMutation,
} = patientsApi
