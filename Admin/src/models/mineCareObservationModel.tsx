import { useMemo } from 'react'
import { z } from 'zod'
import {
  useCreateMineCareObservationMutation,
  useGetMineCareObservationsQuery,
} from '@/services/api/endpoints/mineCareAiApi'
import type {
  CrudFormConfig,
  CrudListQuery,
  CrudListResponse,
  CrudMutationState,
  CrudMutationTrigger,
  CrudSelectOption,
  CrudTableColumn,
} from '@/types/crud'
import type { MineCareObservation } from '@/types/mineCareAi'
import { DetailGrid, StatusBadge, formatDate } from '@/pages/mineCareAi/shared'

export interface MineCareObservationFormValues {
  equipmentId: string
  observationDate: string | Date | null
  observationType: string
  severity: string
  description: string
}

const observationTypeOptions: CrudSelectOption[] = ['Noise', 'Leakage', 'Vibration', 'Heating', 'Low Performance'].map((value) => ({ label: value, value }))
const severityOptions: CrudSelectOption[] = ['Low', 'Medium', 'High', 'Critical'].map((value) => ({ label: value, value }))
const formDate = z.union([z.string(), z.date()]).nullable()

const createSchema = (equipmentIds: string[]) => z.object({
  equipmentId: z.string().trim().min(1, 'Equipment is required').refine((value) => equipmentIds.includes(value), 'Select equipment from the registry'),
  observationDate: formDate,
  observationType: z.string().trim().min(1, 'Observation type is required'),
  severity: z.string().trim().min(1, 'Severity is required'),
  description: z.string().trim().min(1, 'Description is required'),
}) as z.ZodType<MineCareObservationFormValues>

const defaultValues: MineCareObservationFormValues = {
  equipmentId: '',
  observationDate: new Date().toISOString().slice(0, 10),
  observationType: 'Noise',
  severity: 'Medium',
  description: '',
}

function includesText(value: unknown, search: string) {
  return String(value ?? '').toLowerCase().includes(search.toLowerCase())
}

function filterObservations(data: MineCareObservation[], query: CrudListQuery) {
  let filtered = data
  const globalSearch = query.globalSearch?.value?.trim()

  if (globalSearch) {
    filtered = filtered.filter((item) => Object.values(item).some((value) => includesText(value, globalSearch)))
  }

  query.criteria.forEach((criterion) => {
    filtered = filtered.filter((item) => includesText(item[criterion.key as keyof MineCareObservation], String(criterion.value)))
  })

  return filtered
}

function sortObservations(data: MineCareObservation[], query: CrudListQuery) {
  const sortField = query.sortfield as keyof MineCareObservation | undefined
  if (!sortField) return data

  return [...data].sort((left, right) => {
    const direction = query.direction === 'asc' ? 1 : -1
    return String(left[sortField] ?? '').localeCompare(String(right[sortField] ?? ''), undefined, { numeric: true }) * direction
  })
}

export function useMineCareObservationCrudListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetMineCareObservationsQuery(undefined, { skip: options?.skip })

  const data = useMemo<CrudListResponse<MineCareObservation>>(() => {
    const filtered = filterObservations(result.data ?? [], query)
    const sorted = sortObservations(filtered, query)
    const start = (query.page - 1) * query.limit

    return {
      data: sorted.slice(start, start + query.limit),
      total: filtered.length,
      page: query.page,
      limit: query.limit,
    }
  }, [query, result.data])

  return {
    data,
    error: result.error,
    isFetching: result.isFetching,
    isLoading: result.isLoading,
    refetch: result.refetch,
  }
}

export function useCreateMineCareObservationCrudMutation(): readonly [
  CrudMutationTrigger<Partial<MineCareObservation>, MineCareObservation>,
  CrudMutationState,
] {
  const [createObservation, state] = useCreateMineCareObservationMutation()
  return [
    (payload) => ({
      unwrap: async () => createObservation(payload).unwrap(),
    }),
    { isLoading: state.isLoading, error: state.error },
  ] as const
}

function toDateInput(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function createMineCareObservationFormConfig(equipmentOptions: CrudSelectOption[] = []): CrudFormConfig<MineCareObservationFormValues> {
  return {
    schema: createSchema(equipmentOptions.map((option) => String(option.value))),
    defaultValues,
    columns: 2,
    fields: [
      {
        name: 'equipmentId',
        label: 'Equipment',
        type: 'autocomplete',
        section: 'Observation',
        options: equipmentOptions,
        autocomplete: { dropdown: true, forceSelection: true, emptyMessage: 'No equipment found' },
      },
      { name: 'observationDate', label: 'Observation Date', type: 'date', section: 'Observation', date: { dateFormat: 'mm/dd/yy', showButtonBar: true } },
      { name: 'observationType', label: 'Observation Type', type: 'select', section: 'Observation', options: observationTypeOptions },
      { name: 'severity', label: 'Severity', type: 'select', section: 'Observation', options: severityOptions },
      { name: 'description', label: 'Description', type: 'textarea', section: 'Observation', rows: 4, fullWidth: true },
    ],
  }
}

export function createMineCareObservationTableColumns(): Array<CrudTableColumn<MineCareObservation>> {
  return [
    { header: 'Asset', field: 'equipmentId' },
    { header: 'Date', field: 'observationDate', render: (item) => formatDate(item.observationDate) },
    { header: 'Type', field: 'observationType' },
    { header: 'Severity', field: 'severity', render: (item) => <StatusBadge value={item.severity} /> },
    { header: 'Description', field: 'description' },
  ]
}

export function mapMineCareObservationToFormValues(item: MineCareObservation): MineCareObservationFormValues {
  return {
    equipmentId: item.equipmentId,
    observationDate: item.observationDate,
    observationType: item.observationType,
    severity: item.severity,
    description: item.description,
  }
}

export function mapMineCareObservationFormToPayload(values: MineCareObservationFormValues): Partial<MineCareObservation> {
  return {
    equipmentId: values.equipmentId,
    observationDate: toDateInput(values.observationDate),
    observationType: values.observationType,
    severity: values.severity,
    description: values.description,
  }
}

export function renderMineCareObservationDetails(item: MineCareObservation) {
  return (
    <DetailGrid
      values={{
        'Equipment ID': item.equipmentId,
        Date: formatDate(item.observationDate),
        Type: item.observationType,
        Severity: <StatusBadge value={item.severity} />,
        Description: item.description,
      }}
    />
  )
}
