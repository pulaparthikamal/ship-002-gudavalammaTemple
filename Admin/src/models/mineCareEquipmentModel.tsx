import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import {
  useCreateMineCareEquipmentMutation,
  useDeleteMineCareEquipmentMutation,
  useGetMineCareEquipmentQuery,
  useUpdateMineCareEquipmentMutation,
} from '@/services/api/endpoints/mineCareAiApi'
import type { EntityId } from '@/types/common'
import type {
  CrudFormConfig,
  CrudListQuery,
  CrudListResponse,
  CrudMutationState,
  CrudMutationTrigger,
  CrudSelectOption,
  CrudTableColumn,
} from '@/types/crud'
import type { MineCareEquipment, MineCareEquipmentPayload } from '@/types/mineCareAi'
import { DetailGrid, StatusBadge, formatCurrency, formatDate } from '@/pages/mineCareAi/shared'

export interface MineCareEquipmentFormValues {
  equipmentId: string
  name: string
  type: string
  brand: string
  model: string
  serialNumber: string
  location: string
  department: string
  purchaseDate: string | Date | null
  invoiceValue: number | null
  vendor: string
  currentRunningHours: number | null
  averageDailyUsage: number | null
  status: MineCareEquipment['status']
  criticality: MineCareEquipment['criticality']
  warrantyStartDate: string | Date | null
  warrantyEndDate: string | Date | null
  warrantyHourLimit: number | null
  coveredComponents: string
  warrantyTerms: string
  serviceName: string
  serviceIntervalHours: number | null
  serviceRequiredParts: string
  serviceEstimatedCost: number | null
}

export type MineCareBulkDeletePayload = {
  selectedIds: EntityId[]
}

const statusOptions: CrudSelectOption[] = ['Operational', 'Under Maintenance', 'Breakdown', 'Retired'].map((value) => ({ label: value, value }))
const criticalityOptions: CrudSelectOption[] = ['Low', 'Medium', 'High', 'Critical'].map((value) => ({ label: value, value }))
const equipmentTypeOptions: CrudSelectOption[] = ['Excavator', 'Dump Truck', 'Crusher', 'Conveyor', 'Drill', 'Loader', 'Pump', 'Generator'].map((value) => ({ label: value, value }))
const formDate = z.union([z.string(), z.date()]).nullable()

const mineCareEquipmentFormSchema = z.object({
  equipmentId: z.string().trim().min(1, 'Equipment ID is required'),
  name: z.string().trim().min(1, 'Name is required'),
  type: z.string().trim().min(1, 'Type is required'),
  brand: z.string().trim().min(1, 'Brand is required'),
  model: z.string().trim().min(1, 'Model is required'),
  serialNumber: z.string().trim().min(1, 'Serial number is required'),
  location: z.string().trim().min(1, 'Location is required'),
  department: z.string().trim().min(1, 'Department is required'),
  purchaseDate: formDate,
  invoiceValue: z.number().min(0).nullable(),
  vendor: z.string().trim().min(1, 'Vendor is required'),
  currentRunningHours: z.number().min(0).nullable(),
  averageDailyUsage: z.number().min(0).nullable(),
  status: z.enum(['Operational', 'Under Maintenance', 'Breakdown', 'Retired']),
  criticality: z.enum(['Low', 'Medium', 'High', 'Critical']),
  warrantyStartDate: formDate,
  warrantyEndDate: formDate,
  warrantyHourLimit: z.number().min(0).nullable(),
  coveredComponents: z.string().trim(),
  warrantyTerms: z.string().trim(),
  serviceName: z.string().trim(),
  serviceIntervalHours: z.number().min(0).nullable(),
  serviceRequiredParts: z.string().trim(),
  serviceEstimatedCost: z.number().min(0).nullable(),
}) as z.ZodType<MineCareEquipmentFormValues>

const defaultValues: MineCareEquipmentFormValues = {
  equipmentId: '',
  name: '',
  type: '',
  brand: '',
  model: '',
  serialNumber: '',
  location: '',
  department: '',
  purchaseDate: null,
  invoiceValue: 0,
  vendor: '',
  currentRunningHours: 0,
  averageDailyUsage: 0,
  status: 'Operational',
  criticality: 'Medium',
  warrantyStartDate: null,
  warrantyEndDate: null,
  warrantyHourLimit: 0,
  coveredComponents: '',
  warrantyTerms: '',
  serviceName: '',
  serviceIntervalHours: 0,
  serviceRequiredParts: '',
  serviceEstimatedCost: 0,
}

function toDateInput(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function toList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function includesText(value: unknown, search: string) {
  return String(value ?? '').toLowerCase().includes(search.toLowerCase())
}

function filterEquipment(data: MineCareEquipment[], query: CrudListQuery) {
  let filtered = data
  const globalSearch = query.globalSearch?.value?.trim()

  if (globalSearch) {
    filtered = filtered.filter((item) =>
      Object.values(item).some((value) => includesText(value, globalSearch)),
    )
  }

  query.criteria.forEach((criterion) => {
    filtered = filtered.filter((item) => includesText(item[criterion.key as keyof MineCareEquipment], String(criterion.value)))
  })

  return filtered
}

function sortEquipment(data: MineCareEquipment[], query: CrudListQuery) {
  const sortField = query.sortfield as keyof MineCareEquipment | undefined
  if (!sortField) return data

  return [...data].sort((left, right) => {
    const direction = query.direction === 'asc' ? 1 : -1
    return String(left[sortField] ?? '').localeCompare(String(right[sortField] ?? ''), undefined, { numeric: true }) * direction
  })
}

export function useMineCareEquipmentCrudListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetMineCareEquipmentQuery(undefined, { skip: options?.skip })

  const data = useMemo<CrudListResponse<MineCareEquipment>>(() => {
    const filtered = filterEquipment(result.data ?? [], query)
    const sorted = sortEquipment(filtered, query)
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

export function useCreateMineCareEquipmentCrudMutation(): readonly [
  CrudMutationTrigger<Partial<MineCareEquipmentPayload>, MineCareEquipment>,
  CrudMutationState,
] {
  const [createEquipment, state] = useCreateMineCareEquipmentMutation()
  return [
    (payload) => ({
      unwrap: async () => (await createEquipment(payload).unwrap()).equipment,
    }),
    { isLoading: state.isLoading, error: state.error },
  ] as const
}

export function useUpdateMineCareEquipmentCrudMutation(): readonly [
  CrudMutationTrigger<{ id: EntityId; data: Partial<MineCareEquipmentPayload> }, MineCareEquipment>,
  CrudMutationState,
] {
  const [updateEquipment, state] = useUpdateMineCareEquipmentMutation()
  return [
    ({ id, data }) => ({
      unwrap: async () => (await updateEquipment({ id: String(id), data }).unwrap()).equipment,
    }),
    { isLoading: state.isLoading, error: state.error },
  ] as const
}

export function useDeleteMineCareEquipmentCrudMutation(): readonly [CrudMutationTrigger<EntityId, EntityId>, CrudMutationState] {
  const [deleteEquipment, state] = useDeleteMineCareEquipmentMutation()
  return [
    (id) => ({
      unwrap: async () => (await deleteEquipment(String(id)).unwrap()).id,
    }),
    { isLoading: state.isLoading, error: state.error },
  ] as const
}

export function useBulkDeleteMineCareEquipmentCrudMutation(): readonly [
  CrudMutationTrigger<MineCareBulkDeletePayload, { ids: EntityId[] }>,
  CrudMutationState,
] {
  const [deleteEquipment, state] = useDeleteMineCareEquipmentMutation()
  return [
    ({ selectedIds }) => ({
      unwrap: async () => {
        await Promise.all(selectedIds.map((id) => deleteEquipment(String(id)).unwrap()))
        return { ids: selectedIds }
      },
    }),
    { isLoading: state.isLoading, error: state.error },
  ] as const
}

export function createMineCareEquipmentFormConfig(): CrudFormConfig<MineCareEquipmentFormValues> {
  return {
    schema: mineCareEquipmentFormSchema,
    defaultValues,
    columns: 3,
    fields: [
      { name: 'equipmentId', label: 'Equipment ID', type: 'text', section: 'Equipment' },
      { name: 'name', label: 'Name', type: 'text', section: 'Equipment' },
      { name: 'type', label: 'Type', type: 'select', section: 'Equipment', options: equipmentTypeOptions },
      { name: 'brand', label: 'Brand', type: 'text', section: 'Equipment' },
      { name: 'model', label: 'Model', type: 'text', section: 'Equipment' },
      { name: 'serialNumber', label: 'Serial Number', type: 'text', section: 'Equipment' },
      { name: 'location', label: 'Location', type: 'text', section: 'Operations' },
      { name: 'department', label: 'Department', type: 'text', section: 'Operations' },
      { name: 'status', label: 'Status', type: 'select', section: 'Operations', options: statusOptions },
      { name: 'criticality', label: 'Criticality', type: 'select', section: 'Operations', options: criticalityOptions },
      { name: 'currentRunningHours', label: 'Running Hours', type: 'number', section: 'Operations' },
      { name: 'averageDailyUsage', label: 'Average Daily Usage', type: 'number', section: 'Operations' },
      { name: 'purchaseDate', label: 'Purchase Date', type: 'date', section: 'Purchase', date: { dateFormat: 'mm/dd/yy', showButtonBar: true } },
      { name: 'invoiceValue', label: 'Invoice Value', type: 'number', section: 'Purchase' },
      { name: 'vendor', label: 'Vendor', type: 'text', section: 'Purchase' },
      { name: 'warrantyStartDate', label: 'Start Date', type: 'date', section: 'Warranty', date: { dateFormat: 'mm/dd/yy', showButtonBar: true } },
      { name: 'warrantyEndDate', label: 'End Date', type: 'date', section: 'Warranty', date: { dateFormat: 'mm/dd/yy', showButtonBar: true } },
      { name: 'warrantyHourLimit', label: 'Hour Limit', type: 'number', section: 'Warranty' },
      { name: 'coveredComponents', label: 'Covered Components', type: 'text', section: 'Warranty' },
      { name: 'warrantyTerms', label: 'Terms', type: 'textarea', section: 'Warranty', rows: 3, fullWidth: true },
      { name: 'serviceName', label: 'Service Name', type: 'text', section: 'Service Schedule' },
      { name: 'serviceIntervalHours', label: 'Interval Hours', type: 'number', section: 'Service Schedule' },
      { name: 'serviceRequiredParts', label: 'Required Parts', type: 'text', section: 'Service Schedule' },
      { name: 'serviceEstimatedCost', label: 'Estimated Cost', type: 'number', section: 'Service Schedule' },
    ],
  }
}

export function createMineCareEquipmentTableColumns(): Array<CrudTableColumn<MineCareEquipment>> {
  return [
    {
      header: 'Equipment',
      field: 'equipmentId',
      render: (item) => <Link className="font-semibold text-[var(--color-primary)]" to={`/minecare-ai/equipment/${item.equipmentId}`}>{item.equipmentId}</Link>,
    },
    { header: 'Name', field: 'name' },
    { header: 'Type', field: 'type' },
    { header: 'Location', field: 'location' },
    { header: 'Hours', field: 'currentRunningHours' },
    { header: 'Criticality', field: 'criticality', render: (item) => <StatusBadge value={item.criticality} /> },
    { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
  ]
}

export function mapMineCareEquipmentToFormValues(item: MineCareEquipment): MineCareEquipmentFormValues {
  const schedule = item.serviceSchedule?.[0]
  return {
    ...defaultValues,
    equipmentId: item.equipmentId,
    name: item.name,
    type: item.type,
    brand: item.brand,
    model: item.model,
    serialNumber: item.serialNumber,
    location: item.location,
    department: item.department,
    purchaseDate: item.purchaseDate,
    invoiceValue: item.invoiceValue,
    vendor: item.vendor,
    currentRunningHours: item.currentRunningHours,
    averageDailyUsage: item.averageDailyUsage,
    status: item.status,
    criticality: item.criticality,
    warrantyStartDate: item.warranty?.startDate ?? defaultValues.warrantyStartDate,
    warrantyEndDate: item.warranty?.endDate ?? defaultValues.warrantyEndDate,
    warrantyHourLimit: item.warranty?.hourLimit ?? defaultValues.warrantyHourLimit,
    coveredComponents: item.warranty?.coveredComponents?.join(', ') ?? defaultValues.coveredComponents,
    warrantyTerms: item.warranty?.terms ?? defaultValues.warrantyTerms,
    serviceName: schedule?.serviceName ?? defaultValues.serviceName,
    serviceIntervalHours: schedule?.intervalHours ?? defaultValues.serviceIntervalHours,
    serviceRequiredParts: schedule?.requiredParts?.join(', ') ?? defaultValues.serviceRequiredParts,
    serviceEstimatedCost: schedule?.estimatedCost ?? defaultValues.serviceEstimatedCost,
  }
}

export function mapMineCareEquipmentFormToPayload(values: MineCareEquipmentFormValues): Partial<MineCareEquipmentPayload> {
  const hasServiceSchedule = Boolean(
    values.serviceName.trim() ||
    (values.serviceIntervalHours ?? 0) > 0 ||
    values.serviceRequiredParts.trim() ||
    (values.serviceEstimatedCost ?? 0) > 0
  )

  return {
    equipmentId: values.equipmentId,
    name: values.name,
    type: values.type,
    brand: values.brand,
    model: values.model,
    serialNumber: values.serialNumber,
    location: values.location,
    department: values.department,
    purchaseDate: toDateInput(values.purchaseDate),
    invoiceValue: values.invoiceValue ?? 0,
    vendor: values.vendor,
    currentRunningHours: values.currentRunningHours ?? 0,
    averageDailyUsage: values.averageDailyUsage ?? 0,
    status: values.status,
    criticality: values.criticality,
    warranty: {
      startDate: toDateInput(values.warrantyStartDate),
      endDate: toDateInput(values.warrantyEndDate),
      hourLimit: values.warrantyHourLimit ?? 0,
      coveredComponents: toList(values.coveredComponents),
      terms: values.warrantyTerms,
    },
    serviceSchedules: hasServiceSchedule
      ? [
          {
            equipmentType: values.type,
            serviceName: values.serviceName,
            intervalHours: values.serviceIntervalHours ?? 0,
            requiredParts: toList(values.serviceRequiredParts),
            estimatedCost: values.serviceEstimatedCost ?? 0,
          },
        ]
      : [],
  }
}

export function renderMineCareEquipmentDetails(item: MineCareEquipment) {
  return (
    <DetailGrid
      values={{
        'Equipment ID': item.equipmentId,
        Name: item.name,
        Type: item.type,
        Brand: item.brand,
        Model: item.model,
        'Serial Number': item.serialNumber,
        Location: item.location,
        Department: item.department,
        Status: <StatusBadge value={item.status} />,
        Criticality: <StatusBadge value={item.criticality} />,
        'Purchase Date': formatDate(item.purchaseDate),
        'Invoice Value': formatCurrency(item.invoiceValue),
        Vendor: item.vendor,
        'Running Hours': item.currentRunningHours,
        'Average Daily Usage': item.averageDailyUsage,
      }}
    />
  )
}

export function renderMineCareEquipmentGridItem(item: MineCareEquipment) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{item.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{item.equipmentId} · {item.type}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={item.status} />
        <StatusBadge value={item.criticality} />
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{item.location} · {item.currentRunningHours.toLocaleString()} hrs</p>
    </div>
  )
}
