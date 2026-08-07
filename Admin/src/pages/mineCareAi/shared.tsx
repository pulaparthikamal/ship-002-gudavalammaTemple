import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Plus, type LucideIcon } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Paginator } from 'primereact/paginator'
import { CommonTable } from '@/components/crud/CommonTable'
import { Badge as UiBadge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/PageHeader'
import type { EntityId } from '@/types/common'
import type { CrudCriteriaValue, CrudListCriteria, CrudListQuery, CrudTableAction, CrudTableColumn } from '@/types/crud'
import type {
  MineCareAction,
  MineCareAlert,
  MineCareEquipment,
  MineCareEquipmentPayload,
  MineCareObservation,
  MineCareRisk,
  MineCareServiceDue,
  MineCareSparePart,
  MineCareWarrantyClaim,
  MineCareWarrantyStatus,
} from '@/types/mineCareAi'

export const criticalityOptions = ['Low', 'Medium', 'High', 'Critical'].map((value) => ({ label: value, value }))
export const statusOptions = ['Operational', 'Under Maintenance', 'Breakdown', 'Retired'].map((value) => ({ label: value, value }))
export const observationTypes = ['Noise', 'Leakage', 'Vibration', 'Heating', 'Low Performance'].map((value) => ({ label: value, value }))
export const equipmentTypeOptions = ['Excavator', 'Dump Truck', 'Crusher', 'Conveyor', 'Drill', 'Loader', 'Pump', 'Generator'].map((value) => ({ label: value, value }))
export const issueTypeOptions = ['Heating', 'Leakage', 'Vibration', 'Noise', 'Electrical', 'Low Performance'].map((value) => ({ label: value, value }))
export const contractTypeOptions = ['OEM Support', 'Critical Crusher AMC', 'Preventive Maintenance', 'Emergency Support', 'Parts Supply'].map((value) => ({ label: value, value }))

export const defaultEquipmentForm: Partial<MineCareEquipmentPayload> = {
  equipmentId: '',
  name: '',
  type: '',
  brand: '',
  model: '',
  serialNumber: '',
  location: '',
  department: '',
  purchaseDate: '',
  invoiceValue: 0,
  vendor: '',
  currentRunningHours: 0,
  averageDailyUsage: 0,
  status: undefined,
  criticality: undefined,
  warranty: {
    startDate: '',
    endDate: '',
    hourLimit: 0,
    coveredComponents: [],
    terms: '',
  },
  serviceSchedules: [
    {
      equipmentType: '',
      serviceName: '',
      intervalHours: 0,
      requiredParts: [],
      estimatedCost: 0,
    },
  ],
}

const defaultQuery: CrudListQuery = {
  page: 1,
  limit: 20,
  criteria: [],
}

const pageSizeOptions = [5, 10, 20, 50]

export function formatCurrency(value?: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value ?? 0)
}

export function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

export function formatNumber(value?: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value ?? 0)
}

export function normalizePercentRatio(value?: number) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  const ratio = parsed > 1 ? parsed / 100 : parsed
  return Math.max(0, Math.min(1, ratio))
}

export function formatPercent(value?: number) {
  return `${Math.round(normalizePercentRatio(value) * 100)}%`
}

export const formatConfidence = formatPercent

export function equipmentOptions(equipment: MineCareEquipment[] = []) {
  return equipment.map((item) => ({
    label: `${item.name || item.type} ${item.equipmentId}`,
    value: item.equipmentId,
    type: item.type,
    location: item.location,
  }))
}

export function selectedEquipmentType(equipment: MineCareEquipment[] = [], equipmentId?: string) {
  return equipment.find((item) => item.equipmentId === equipmentId)?.type ?? ''
}

export function errorMessage(error: unknown, fallback = 'Unable to complete the request right now.') {
  if (!error || typeof error !== 'object') return fallback
  const response = error as { data?: { respMessage?: string; message?: string; detail?: string }; message?: string }
  return response.data?.respMessage || response.data?.message || response.data?.detail || response.message || fallback
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Action needed</p>
        <p>{message}</p>
      </div>
    </div>
  )
}

export function ConfidenceBadge({ value, source }: { value?: number; source?: string }) {
  const label = source?.includes('fallback') ? 'Fallback' : source?.includes('agentic') ? 'Agentic' : 'AI Generated'
  const confidence = formatConfidence(value)
  return <UiBadge variant={source?.includes('fallback') ? 'warning' : 'secondary'}>{label}{confidence !== '0%' ? ` ${confidence}` : ''}</UiBadge>
}

function badgeVariant(value?: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  const normalized = value?.toLowerCase() ?? ''
  if (normalized.includes('critical') || normalized.includes('expired') || normalized.includes('overdue') || normalized.includes('breakdown')) return 'destructive'
  if (normalized.includes('high') || normalized.includes('soon') || normalized.includes('shortage') || normalized.includes('due')) return 'warning'
  if (normalized.includes('medium') || normalized.includes('maintenance')) return 'secondary'
  return 'success'
}

export function StatusBadge({ value }: { value?: string }) {
  return <UiBadge variant={badgeVariant(value)} className="whitespace-nowrap">{value ?? '-'}</UiBadge>
}

export function SummaryCard({ label, value, icon: Icon, detail, compact = false }: { label: string; value: ReactNode; icon: LucideIcon; detail?: ReactNode; compact?: boolean }) {
  return (
    <article className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${compact ? 'p-3' : 'p-5'}`}>
      <div className={`flex items-center justify-between ${compact ? 'gap-3' : 'gap-4'}`}>
        <div className="min-w-0">
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-[var(--color-text-muted)]`}>{label}</p>
          <p className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-3xl'} truncate font-semibold text-[var(--color-text-strong)]`}>{value}</p>
          {detail ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{detail}</p> : null}
        </div>
        <div className={`grid shrink-0 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] ${compact ? 'h-8 w-8' : 'h-11 w-11'}`}>
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}

export function SurfacePanel({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function ScrollRegion({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-h-[28rem] overflow-y-auto pr-1 ${className}`}>{children}</div>
}

export function MineCarePage({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto space-y-8">
      <PageHeader eyebrow="MineCare AI" title={title} description={description} actions={actions} />
      {children}
    </div>
  )
}

export function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-xs text-[var(--color-text)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function DetailGrid({ values }: { values: Record<string, ReactNode> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{key}</dt>
          <dd className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-sm text-[var(--color-text-muted)]">{message}</div>
}

function normalizeCriteriaValue(value: CrudCriteriaValue) {
  if (value instanceof Date) return value.toISOString().toLowerCase()
  if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase())
  return String(value ?? '').toLowerCase()
}

function readTableValue<TItem>(item: TItem, key: string) {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, item)

  return value instanceof Date ? value.toISOString() : String(value ?? '')
}

function matchesCriterion<TItem>(item: TItem, criterion: CrudListCriteria) {
  const rawValue = readTableValue(item, criterion.key).toLowerCase()
  const filterValue = normalizeCriteriaValue(criterion.value)

  if (Array.isArray(filterValue)) {
    const hasMatch = filterValue.some((value) => rawValue === value || rawValue.includes(value))
    return criterion.type === 'nin' ? !hasMatch : hasMatch
  }

  switch (criterion.type) {
    case 'eq':
    case 'dateis':
      return rawValue === filterValue
    case 'ne':
    case 'dateIsNot':
      return rawValue !== filterValue
    case 'sw':
      return rawValue.startsWith(filterValue)
    case 'ew':
      return rawValue.endsWith(filterValue)
    case 'notContains':
      return !rawValue.includes(filterValue)
    case 'lt':
    case 'datelt':
      return Number(rawValue) < Number(filterValue) || rawValue < filterValue
    case 'lte':
      return Number(rawValue) <= Number(filterValue) || rawValue <= filterValue
    case 'gt':
    case 'dategt':
      return Number(rawValue) > Number(filterValue) || rawValue > filterValue
    case 'gte':
      return Number(rawValue) >= Number(filterValue) || rawValue >= filterValue
    case 'contains':
    case 'regexOr':
    default:
      return rawValue.includes(filterValue)
  }
}

function compareTableValues(left: string, right: string) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber
  return left.localeCompare(right)
}

export function MineCareTable<TItem>({
  data,
  columns,
  getRowId,
  actions,
  emptyMessage,
  isLoading = false,
  rowClassName,
  showSelection = false,
  selectedItems,
  onSelectionChange,
  tableHeightClassName = 'max-h-[32rem]',
}: {
  data: TItem[]
  columns: Array<CrudTableColumn<TItem>>
  getRowId: (item: TItem) => EntityId
  actions?: Array<CrudTableAction<TItem>>
  emptyMessage: string
  isLoading?: boolean
  rowClassName?: (item: TItem) => string
  showSelection?: boolean
  selectedItems?: TItem[]
  onSelectionChange?: (items: TItem[]) => void
  tableHeightClassName?: string
}) {
  const [query, setQuery] = useState<CrudListQuery>(defaultQuery)
  const [internalSelectedItems, setInternalSelectedItems] = useState<TItem[]>([])
  const tableSelectedItems = selectedItems ?? internalSelectedItems
  const handleSelectionChange = onSelectionChange ?? setInternalSelectedItems
  const filteredData = useMemo(() => {
    const criteria = query.criteria ?? []
    return criteria.length ? data.filter((item) => criteria.every((criterion) => matchesCriterion(item, criterion))) : data
  }, [data, query.criteria])

  const sortedData = useMemo(() => {
    if (!query.sortfield) return filteredData
    const direction = query.direction === 'desc' ? -1 : 1
    return [...filteredData].sort((left, right) => compareTableValues(readTableValue(left, query.sortfield ?? ''), readTableValue(right, query.sortfield ?? '')) * direction)
  }, [filteredData, query.direction, query.sortfield])

  const pageStart = (query.page - 1) * query.limit
  const pageData = sortedData.slice(pageStart, pageStart + query.limit)
  const totalRecords = filteredData.length

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(totalRecords / query.limit))
    if (query.page > lastPage) {
      setQuery((current) => ({ ...current, page: lastPage }))
    }
  }, [query.limit, query.page, totalRecords])

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className={`${tableHeightClassName} overflow-auto`}>
        <CommonTable
          data={pageData}
          query={query}
          totalRecords={totalRecords}
          columns={columns}
          getRowId={getRowId}
          onQueryChange={setQuery}
          selectedItems={tableSelectedItems}
          onSelectionChange={handleSelectionChange}
          actions={actions}
          emptyMessage={emptyMessage}
          isLoading={isLoading}
          rowClassName={rowClassName}
          showSelection={showSelection}
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
        <Paginator
          first={pageStart}
          rows={query.limit}
          totalRecords={totalRecords}
          rowsPerPageOptions={pageSizeOptions}
          template="CurrentPageReport RowsPerPageDropdown"
          currentPageReportTemplate="Showing {first}-{last} of {totalRecords}"
          className="compact-paginator justify-start"
          onPageChange={(event) => setQuery((current) => ({ ...current, page: Math.floor(event.first / event.rows) + 1, limit: event.rows }))}
        />
        <Paginator
          first={pageStart}
          rows={query.limit}
          totalRecords={totalRecords}
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
          className="compact-paginator justify-end"
          onPageChange={(event) => setQuery((current) => ({ ...current, page: Math.floor(event.first / event.rows) + 1, limit: event.rows }))}
        />
      </div>
    </div>
  )
}

export function EquipmentForm({
  initial,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  initial?: Partial<MineCareEquipmentPayload>
  onCancel: () => void
  onSubmit: (payload: Partial<MineCareEquipmentPayload>) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState<Partial<MineCareEquipmentPayload>>({ ...defaultEquipmentForm, ...initial })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const setValue = (key: keyof MineCareEquipmentPayload, value: string | number) => setForm((current) => ({ ...current, [key]: value }))
  const setWarrantyValue = (key: string, value: string | number) =>
    setForm((current) => ({ ...current, warranty: { ...current.warranty, [key]: value } }))
  const setScheduleValue = (key: string, value: string | number) =>
    setForm((current) => ({
      ...current,
      serviceSchedules: [{ ...(current.serviceSchedules?.[0] ?? {}), [key]: value, equipmentType: String(current.type || 'Equipment') }],
    }))
  const fieldError = (key: string) => errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null
  const validate = () => {
    const nextErrors: Record<string, string> = {}
    const requiredTextFields: Array<[keyof MineCareEquipmentPayload, string]> = [
      ['equipmentId', 'Equipment ID is required'],
      ['name', 'Name is required'],
      ['type', 'Type is required'],
      ['brand', 'Brand is required'],
      ['model', 'Model is required'],
      ['serialNumber', 'Serial number is required'],
      ['purchaseDate', 'Purchase date is required'],
      ['vendor', 'Vendor is required'],
    ]

    requiredTextFields.forEach(([key, message]) => {
      if (!String(form[key] ?? '').trim()) nextErrors[String(key)] = message
    })

    if (Number(form.invoiceValue ?? 0) <= 0) nextErrors.invoiceValue = 'Invoice value must be greater than 0'
    if (Number(form.currentRunningHours ?? -1) < 0) nextErrors.currentRunningHours = 'Running hours must be 0 or greater'
    if (Number(form.averageDailyUsage ?? 0) <= 0) nextErrors.averageDailyUsage = 'Average daily usage must be greater than 0'
    if (!String(form.warranty?.startDate ?? '').trim()) nextErrors.warrantyStartDate = 'Warranty start date is required'
    if (!String(form.warranty?.endDate ?? '').trim()) nextErrors.warrantyEndDate = 'Warranty end date is required'
    if (Number(form.warranty?.hourLimit ?? 0) <= 0) nextErrors.warrantyHourLimit = 'Warranty hour limit must be greater than 0'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const schedule = form.serviceSchedules?.[0]
      const hasSchedule = Boolean(
        String(schedule?.serviceName ?? '').trim() ||
        Number(schedule?.intervalHours ?? 0) > 0 ||
        Number(schedule?.estimatedCost ?? 0) > 0 ||
        (Array.isArray(schedule?.requiredParts) ? schedule?.requiredParts.length : String(schedule?.requiredParts ?? '').trim())
      )
      await onSubmit({
        ...form,
        invoiceValue: Number(form.invoiceValue ?? 0),
        currentRunningHours: Number(form.currentRunningHours ?? 0),
        averageDailyUsage: Number(form.averageDailyUsage ?? 1),
        warranty: {
          ...form.warranty,
          hourLimit: Number(form.warranty?.hourLimit ?? 0),
          coveredComponents: typeof (form.warranty?.coveredComponents as unknown) === 'string'
            ? String(form.warranty?.coveredComponents).split(',').map((item) => item.trim()).filter(Boolean)
            : form.warranty?.coveredComponents ?? [],
        },
        serviceSchedules: hasSchedule
          ? [
              {
                ...(schedule ?? {}),
                equipmentType: String(form.type || schedule?.equipmentType || ''),
                intervalHours: Number(schedule?.intervalHours ?? 0),
                estimatedCost: Number(schedule?.estimatedCost ?? 0),
                requiredParts: typeof (schedule?.requiredParts as unknown) === 'string'
                  ? String(schedule?.requiredParts).split(',').map((item) => item.trim()).filter(Boolean)
                  : schedule?.requiredParts ?? [],
              },
            ]
          : [],
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Equipment ID<InputText value={form.equipmentId ?? ''} onChange={(event) => setValue('equipmentId', event.target.value)} className="w-full" />{fieldError('equipmentId')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Name<InputText value={form.name ?? ''} onChange={(event) => setValue('name', event.target.value)} className="w-full" />{fieldError('name')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Type<Dropdown value={form.type} options={equipmentTypeOptions} onChange={(event) => setValue('type', event.value)} className="w-full" />{fieldError('type')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Brand<InputText value={form.brand ?? ''} onChange={(event) => setValue('brand', event.target.value)} className="w-full" />{fieldError('brand')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Model<InputText value={form.model ?? ''} onChange={(event) => setValue('model', event.target.value)} className="w-full" />{fieldError('model')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Serial Number<InputText value={form.serialNumber ?? ''} onChange={(event) => setValue('serialNumber', event.target.value)} className="w-full" />{fieldError('serialNumber')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Location<InputText value={form.location ?? ''} onChange={(event) => setValue('location', event.target.value)} className="w-full" /></label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Department<InputText value={form.department ?? ''} onChange={(event) => setValue('department', event.target.value)} className="w-full" /></label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Purchase Date<input type="date" value={String(form.purchaseDate ?? '')} onChange={(event) => setValue('purchaseDate', event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />{fieldError('purchaseDate')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Invoice Value<InputNumber value={Number(form.invoiceValue ?? 0)} min={0} onValueChange={(event) => setValue('invoiceValue', Number(event.value ?? 0))} className="w-full" inputClassName="w-full" />{fieldError('invoiceValue')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Vendor<InputText value={form.vendor ?? ''} onChange={(event) => setValue('vendor', event.target.value)} className="w-full" />{fieldError('vendor')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Running Hours<InputNumber value={Number(form.currentRunningHours ?? 0)} min={0} onValueChange={(event) => setValue('currentRunningHours', Number(event.value ?? 0))} className="w-full" inputClassName="w-full" />{fieldError('currentRunningHours')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Average Daily Usage<InputNumber value={Number(form.averageDailyUsage ?? 0)} min={0} onValueChange={(event) => setValue('averageDailyUsage', Number(event.value ?? 0))} className="w-full" inputClassName="w-full" />{fieldError('averageDailyUsage')}</label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Status<Dropdown value={form.status} options={statusOptions} onChange={(event) => setValue('status', event.value)} className="w-full" /></label>
      <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Criticality<Dropdown value={form.criticality} options={criticalityOptions} onChange={(event) => setValue('criticality', event.value)} className="w-full" /></label>
      <div className="mt-2 border-t border-[var(--color-border)] pt-4 md:col-span-2">
        <h3 className="mb-3 font-semibold text-[var(--color-text-strong)]">Warranty details</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Start Date<input type="date" value={String(form.warranty?.startDate ?? '')} onChange={(event) => setWarrantyValue('startDate', event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />{fieldError('warrantyStartDate')}</label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">End Date<input type="date" value={String(form.warranty?.endDate ?? '')} onChange={(event) => setWarrantyValue('endDate', event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />{fieldError('warrantyEndDate')}</label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Hour Limit<InputNumber value={Number(form.warranty?.hourLimit ?? 0)} min={0} onValueChange={(event) => setWarrantyValue('hourLimit', Number(event.value ?? 0))} className="w-full" inputClassName="w-full" />{fieldError('warrantyHourLimit')}</label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Covered Components<InputText value={Array.isArray(form.warranty?.coveredComponents) ? form.warranty?.coveredComponents.join(', ') : String(form.warranty?.coveredComponents ?? '')} onChange={(event) => setWarrantyValue('coveredComponents', event.target.value)} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)] md:col-span-2">Terms<InputTextarea rows={3} value={form.warranty?.terms ?? ''} onChange={(event) => setWarrantyValue('terms', event.target.value)} className="w-full" /></label>
        </div>
      </div>
      <div className="border-t border-[var(--color-border)] pt-4 md:col-span-2">
        <h3 className="mb-3 font-semibold text-[var(--color-text-strong)]">OEM service schedule</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Service Name<InputText value={form.serviceSchedules?.[0]?.serviceName ?? ''} onChange={(event) => setScheduleValue('serviceName', event.target.value)} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Interval Hours<InputNumber value={Number(form.serviceSchedules?.[0]?.intervalHours ?? 0)} min={0} onValueChange={(event) => setScheduleValue('intervalHours', Number(event.value ?? 0))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Required Parts<InputText value={Array.isArray(form.serviceSchedules?.[0]?.requiredParts) ? form.serviceSchedules?.[0]?.requiredParts.join(', ') : String(form.serviceSchedules?.[0]?.requiredParts ?? '')} onChange={(event) => setScheduleValue('requiredParts', event.target.value)} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-text)]">Estimated Cost<InputNumber value={Number(form.serviceSchedules?.[0]?.estimatedCost ?? 0)} min={0} onValueChange={(event) => setScheduleValue('estimatedCost', Number(event.value ?? 0))} className="w-full" inputClassName="w-full" /></label>
        </div>
      </div>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button label="Cancel" severity="secondary" outlined onClick={onCancel} />
        <Button label={submitLabel} icon={<Plus className="h-4 w-4" />} loading={saving} onClick={submit} />
      </div>
    </div>
  )
}

export function ServiceTable({
  services,
  actions,
  tableHeightClassName,
}: {
  services: MineCareServiceDue[]
  actions?: Array<CrudTableAction<MineCareServiceDue>>
  tableHeightClassName?: string
}) {
  return (
    <MineCareTable
      data={services}
      getRowId={(item) => `${item.equipmentId}-${item.serviceName}-${item.serviceDueDate}`}
      emptyMessage="No service due records."
      actions={actions}
      tableHeightClassName={tableHeightClassName}
      columns={[
        {
          header: 'Asset',
          key: 'asset',
          render: (item) => (
            <div className="min-w-48">
              <p className="font-semibold text-[var(--color-text-strong)]">{item.equipmentName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.equipmentId}</p>
            </div>
          ),
        },
        { header: 'Service', field: 'serviceName', className: 'min-w-56' },
        { header: 'Due Days', field: 'remainingDays' },
        { header: 'Due Hours', field: 'remainingHours' },
        { header: 'Cost', field: 'estimatedCost', render: (item) => formatCurrency(item.estimatedCost) },
        { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
        {
          header: 'AI Action',
          key: 'aiRecommendedAction',
          className: 'min-w-80',
          render: (item) => <span className="whitespace-normal text-sm">{item.aiRecommendedAction ?? '-'}</span>,
        },
      ]}
    />
  )
}

export function WarrantyTable({ warranties, tableHeightClassName }: { warranties: MineCareWarrantyStatus[]; tableHeightClassName?: string }) {
  return (
    <MineCareTable
      data={warranties}
      getRowId={(item) => item.equipmentId}
      emptyMessage="No warranty records."
      tableHeightClassName={tableHeightClassName}
      columns={[
        {
          header: 'Asset',
          key: 'asset',
          render: (item) => (
            <div className="min-w-48">
              <p className="font-semibold text-[var(--color-text-strong)]">{item.equipmentName ?? item.equipmentId}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.equipmentId}</p>
            </div>
          ),
        },
        { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
        { header: 'Remaining Days', field: 'remainingDays' },
        { header: 'Remaining Hours', field: 'remainingHours' },
        {
          header: 'AI Recommendation',
          key: 'aiRecommendation',
          className: 'min-w-80',
          render: (item) => <span className="whitespace-normal text-sm">{item.aiRecommendation ?? '-'}</span>,
        },
      ]}
    />
  )
}

export function ObservationTable({ observations }: { observations: MineCareObservation[] }) {
  return (
    <MineCareTable
      data={observations}
      getRowId={(item) => item._id || `${item.equipmentId}-${item.observationDate}-${item.observationType}`}
      emptyMessage="No operator observations found."
      columns={[
        { header: 'Asset', field: 'equipmentId' },
        { header: 'Date', field: 'observationDate', render: (item) => formatDate(item.observationDate) },
        { header: 'Type', field: 'observationType' },
        { header: 'Severity', field: 'severity', render: (item) => <StatusBadge value={item.severity} /> },
        { header: 'Description', field: 'description' },
      ]}
    />
  )
}

export function AlertTable({
  alerts,
  onStatusChange,
  tableHeightClassName,
}: {
  alerts: MineCareAlert[]
  onStatusChange?: (item: MineCareAlert, status: 'Open' | 'Acknowledged' | 'Closed') => void
  tableHeightClassName?: string
}) {
  return (
    <MineCareTable
      data={alerts}
      tableHeightClassName={tableHeightClassName}
      getRowId={(item) => item.id ?? `${item.type}-${item.equipmentId ?? item.partNumber ?? 'general'}-${item.message}`}
      emptyMessage="No alerts."
      columns={[
        { header: 'Type', field: 'type' },
        { header: 'Severity', field: 'severity', render: (item) => <StatusBadge value={item.severity} /> },
        {
          header: 'Status',
          key: 'status',
          render: (item) => onStatusChange ? (
            <Dropdown
              value={item.status ?? 'Open'}
              options={['Open', 'Acknowledged', 'Closed'].map((value) => ({ label: value, value }))}
              onChange={(event) => onStatusChange(item, event.value)}
              className="w-44"
            />
          ) : <StatusBadge value={item.status ?? 'Open'} />,
        },
        { header: 'Asset', field: 'equipmentId' },
        { header: 'Message', field: 'message' },
        { header: 'AI Action', key: 'recommendedAction', render: (item) => item.recommendedAction ?? '-' },
      ]}
    />
  )
}

export function ActionTable({
  actions,
  onStatusChange,
  tableHeightClassName,
}: {
  actions: MineCareAction[]
  onStatusChange?: (item: MineCareAction, status: 'Open' | 'In Progress' | 'Completed') => void
  tableHeightClassName?: string
}) {
  return (
    <MineCareTable
      data={actions}
      tableHeightClassName={tableHeightClassName}
      getRowId={(item) => item.id ?? `${item.priority}-${item.equipment}-${item.action}`}
      emptyMessage="No recommended actions."
      columns={[
        { header: 'Priority', field: 'priority', render: (item) => <StatusBadge value={item.priority} /> },
        {
          header: 'Status',
          key: 'status',
          render: (item) => onStatusChange ? (
            <Dropdown
              value={item.status ?? 'Open'}
              options={['Open', 'In Progress', 'Completed'].map((value) => ({ label: value, value }))}
              onChange={(event) => onStatusChange(item, event.value)}
              className="w-44"
            />
          ) : <StatusBadge value={item.status ?? 'Open'} />,
        },
        { header: 'Equipment', field: 'equipment' },
        { header: 'Name', field: 'equipmentName' },
        { header: 'Action', field: 'action' },
        { header: 'Source', field: 'source' },
      ]}
    />
  )
}

export function RiskTable({ risks }: { risks: MineCareRisk[] }) {
  return (
    <MineCareTable
      data={risks}
      getRowId={(item) => item.equipmentId}
      emptyMessage="No ranked assets found."
      columns={[
        { header: 'Asset', field: 'equipmentId' },
        { header: 'Name', field: 'equipmentName' },
        { header: 'Type', field: 'type' },
        { header: 'Criticality', field: 'criticality', render: (item) => <StatusBadge value={item.criticality} /> },
        { header: 'Health', field: 'healthScore' },
        { header: 'Risk Score', field: 'score' },
        { header: 'Priority', field: 'priority', render: (item) => <StatusBadge value={item.priority} /> },
        { header: 'AI Action', key: 'nextBestAction', render: (item) => item.nextBestAction ?? '-' },
      ]}
    />
  )
}

export function SparePartTable({ parts }: { parts: MineCareSparePart[] }) {
  return (
    <MineCareTable
      data={parts}
      getRowId={(item) => item._id || item.partNumber}
      emptyMessage="No spare parts forecast available."
      columns={[
        { header: 'Part', field: 'partNumber' },
        { header: 'Name', field: 'partName' },
        { header: 'Stock', field: 'currentStock' },
        { header: 'Required', field: 'requiredQuantity' },
        {
          header: 'Demand Source',
          key: 'demandSources',
          render: (item) => {
            const sources = item.demandSources ?? []
            if (!sources.length) return '-'
            const visibleSources = sources.slice(0, 2)
            return (
              <div className="min-w-56 space-y-1 text-xs text-[var(--color-text)]">
                {visibleSources.map((source) => (
                  <div key={source} className="whitespace-nowrap">{source}</div>
                ))}
                {sources.length > visibleSources.length ? (
                  <div className="text-[var(--color-text-muted)]">+{sources.length - visibleSources.length} more</div>
                ) : null}
              </div>
            )
          },
        },
        { header: 'Reorder Qty', field: 'reorderQuantity' },
        { header: 'Reorder Cost', field: 'reorderCost', render: (item) => formatCurrency(item.reorderCost) },
        { header: 'Status', key: 'status', render: (item) => <StatusBadge value={item.reorderRecommended ? 'Shortage' : 'Available'} /> },
        { header: 'AI Recommendation', key: 'aiRecommendation', render: (item) => item.aiRecommendation ?? '-' },
      ]}
    />
  )
}

export function WarrantyClaimTable({
  claims,
  onStatusChange,
  tableHeightClassName,
}: {
  claims: MineCareWarrantyClaim[]
  onStatusChange?: (item: MineCareWarrantyClaim, status: 'Potential' | 'Submitted' | 'Approved' | 'Rejected') => void
  tableHeightClassName?: string
}) {
  return (
    <MineCareTable
      data={claims}
      getRowId={(item) => item.id ?? `${item.equipmentId}-${item.breakdownId}`}
      emptyMessage="No claims detected."
      tableHeightClassName={tableHeightClassName}
      columns={[
        {
          header: 'Asset',
          key: 'asset',
          render: (item) => (
            <div className="min-w-48">
              <p className="font-semibold text-[var(--color-text-strong)]">{item.equipmentName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.equipmentId}</p>
            </div>
          ),
        },
        { header: 'Failure', field: 'failureType', className: 'min-w-44' },
        {
          header: 'Status',
          key: 'status',
          render: (item) => onStatusChange ? (
            <Dropdown
              value={item.status ?? 'Potential'}
              options={['Potential', 'Submitted', 'Approved', 'Rejected'].map((value) => ({ label: value, value }))}
              onChange={(event) => onStatusChange(item, event.value)}
              className="w-40"
            />
          ) : <StatusBadge value={item.status ?? 'Potential'} />,
        },
        { header: 'Date', field: 'breakdownDate', render: (item) => formatDate(item.breakdownDate) },
        { header: 'Recoverable', field: 'recoverableCost', render: (item) => formatCurrency(item.recoverableCost) },
        { header: 'Claim Fit', key: 'claimProbability', render: (item) => item.claimProbability !== undefined ? formatPercent(item.claimProbability) : '-' },
        {
          header: 'Recommendation',
          field: 'recommendation',
          className: 'min-w-80',
          render: (item) => <span className="whitespace-normal text-sm">{item.recommendation}</span>,
        },
      ]}
    />
  )
}
