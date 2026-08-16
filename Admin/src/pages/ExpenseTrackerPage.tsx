import { useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Download, Plus, Upload } from 'lucide-react'
import { EditableGrid } from '@/components/crud/EditableGrid'
import type { EditableGridColumn } from '@/components/crud/EditableGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { YearFilter } from '@/components/ui/YearFilter'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import {
  useBulkCreateExpenseEntriesMutation,
  useCreateExpenseEntryMutation,
  useDeleteExpenseEntryMutation,
  useGetExpenseEntriesQuery,
  useGetExpenseSummaryQuery,
  useUpdateExpenseEntryMutation,
} from '@/services/api/endpoints/expenseEntriesApi'
import type {
  ExpenseEntry,
  ExpenseEntryCreatePayload,
  ExpensePaymentMode,
  ExpenseEntryType,
} from '@/services/api/endpoints/expenseEntriesApi'
import {
  useCreateExpenseEventMutation,
  useGetExpenseEventsQuery,
} from '@/services/api/endpoints/expenseEventsApi'

const GENERAL_EVENT_VALUE = 'general'

const typeOptions = [
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
]

const paymentModeOptions = [
  { label: 'Cash', value: 'cash' },
  { label: 'UPI', value: 'upi' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Other', value: 'other' },
]

const newEventSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  budget: z.number().min(0, 'Budget must be 0 or more'),
})

type NewEventFormValues = z.infer<typeof newEventSchema>

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function findHeaderValue(row: Record<string, unknown>, candidates: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value] as const)
  for (const candidate of candidates) {
    const match = normalizedEntries.find(([key]) => key === candidate)
    if (match) return match[1]
  }
  return undefined
}

function parseImportRow(row: Record<string, unknown>): Partial<ExpenseEntryCreatePayload> | null {
  const rawDate = findHeaderValue(row, ['date'])
  const rawCategory = findHeaderValue(row, ['category'])
  const rawDescription = findHeaderValue(row, ['description'])
  const rawAmount = findHeaderValue(row, ['amount'])
  const rawType = findHeaderValue(row, ['type'])
  const rawPaymentMode = findHeaderValue(row, ['paymentmode', 'payment mode', 'payment_mode'])

  if (rawAmount === undefined || rawCategory === undefined) {
    return null
  }

  let date: string | undefined
  if (rawDate instanceof Date) {
    date = rawDate.toISOString()
  } else if (typeof rawDate === 'number') {
    // Excel serial date
    const parsed = XLSX.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(rawDate) : null
    date = parsed ? new Date(parsed.y, parsed.m - 1, parsed.d).toISOString() : new Date().toISOString()
  } else if (typeof rawDate === 'string' && rawDate.trim()) {
    const parsed = new Date(rawDate)
    date = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
  } else {
    date = new Date().toISOString()
  }

  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount)
  const typeValue = String(rawType ?? 'expense').trim().toLowerCase()
  const paymentModeValue = String(rawPaymentMode ?? 'cash').trim().toLowerCase().replace(/\s+/g, '_')

  return {
    date,
    category: String(rawCategory).trim(),
    description: rawDescription !== undefined ? String(rawDescription).trim() : undefined,
    amount,
    type: (typeValue === 'income' ? 'income' : 'expense') as ExpenseEntryType,
    paymentMode: (paymentModeOptions.some((option) => option.value === paymentModeValue)
      ? paymentModeValue
      : 'cash') as ExpensePaymentMode,
  }
}

export function ExpenseTrackerPage() {
  const { t } = useStaffTranslation()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [eventFilter, setEventFilter] = useState<string>(GENERAL_EVENT_VALUE)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [isNewEventOpen, setIsNewEventOpen] = useState(false)

  const handleYearChange = (selected: number | null) => {
    setYear(selected)
    setDateFrom(selected ? new Date(selected, 0, 1) : null)
    setDateTo(selected ? new Date(selected, 11, 31, 23, 59, 59, 999) : null)
  }

  const eventsQuery = useGetExpenseEventsQuery()
  const eventOptions = useMemo(
    () => [
      { label: t('General / Ongoing'), value: GENERAL_EVENT_VALUE },
      ...(eventsQuery.data ?? []).map((event) => ({ label: event.name, value: event._id })),
    ],
    [eventsQuery.data, t],
  )

  const translatedTypeOptions = useMemo(
    () => typeOptions.map((option) => ({ ...option, label: t(option.label) })),
    [t],
  )
  const translatedPaymentModeOptions = useMemo(
    () => paymentModeOptions.map((option) => ({ ...option, label: t(option.label) })),
    [t],
  )

  const effectiveEventId = eventFilter === GENERAL_EVENT_VALUE ? null : eventFilter
  const fromIso = toIsoDate(dateFrom)
  const toIso = toIsoDate(dateTo)

  const entriesQuery = useGetExpenseEntriesQuery({
    page: 1,
    limit: 500,
    sortfield: 'date',
    direction: 'desc',
    criteria: [],
    eventId: effectiveEventId,
    category: categoryFilter || undefined,
    from: fromIso,
    to: toIso,
  })

  const summaryQuery = useGetExpenseSummaryQuery({
    eventId: effectiveEventId,
    from: fromIso,
    to: toIso,
  })

  const [createExpenseEntry] = useCreateExpenseEntryMutation()
  const [updateExpenseEntry] = useUpdateExpenseEntryMutation()
  const [deleteExpenseEntry] = useDeleteExpenseEntryMutation()
  const [bulkCreateExpenseEntries, { isLoading: isImporting }] = useBulkCreateExpenseEntriesMutation()
  const [createExpenseEvent, { isLoading: isCreatingEvent }] = useCreateExpenseEventMutation()

  const rows = entriesQuery.data?.data ?? []

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewEventFormValues>({
    resolver: zodResolver(newEventSchema),
    defaultValues: {
      name: '',
      startDate: new Date(),
      endDate: null,
      budget: 0,
    },
  })

  const handleRowUpdate = async (id: string, patch: Partial<ExpenseEntry>) => {
    try {
      const data: Record<string, unknown> = { ...patch }
      if (data.date instanceof Date) {
        data.date = (data.date as Date).toISOString()
      }
      await updateExpenseEntry({ id, data }).unwrap()
    } catch (error) {
      showToast({ severity: 'error', summary: t('Update failed'), detail: getApiErrorMessage(error) })
    }
  }

  const handleRowDelete = async (id: string) => {
    try {
      await deleteExpenseEntry(id).unwrap()
      showToast({ severity: 'success', summary: t('Deleted'), detail: t('Entry removed.') })
    } catch (error) {
      showToast({ severity: 'error', summary: t('Delete failed'), detail: getApiErrorMessage(error) })
    }
  }

  const handleRowAdd = async () => {
    try {
      await createExpenseEntry({
        date: new Date().toISOString(),
        eventId: effectiveEventId,
        category: 'Uncategorized',
        description: '',
        amount: 0,
        type: 'expense',
        paymentMode: 'cash',
      }).unwrap()
    } catch (error) {
      showToast({ severity: 'error', summary: t('Could not add row'), detail: getApiErrorMessage(error) })
    }
  }

  const columns: Array<EditableGridColumn<ExpenseEntry>> = [
    { field: 'date', header: t('Date'), type: 'date' },
    { field: 'category', header: t('Category'), type: 'text' },
    { field: 'description', header: t('Description'), type: 'text' },
    { field: 'amount', header: t('Amount'), type: 'number', align: 'right' },
    { field: 'type', header: t('Type'), type: 'select', options: translatedTypeOptions },
    { field: 'paymentMode', header: t('Payment Mode'), type: 'select', options: translatedPaymentModeOptions },
  ]

  const handleExport = () => {
    const exportRows = rows.map((row) => ({
      Date: row.date ? new Date(row.date).toISOString().slice(0, 10) : '',
      Category: row.category,
      Description: row.description ?? '',
      Amount: row.amount,
      Type: row.type,
      PaymentMode: row.paymentMode,
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, t('Expenses'))
    XLSX.writeFile(workbook, 'expenses.xlsx')
  }

  const handleImportFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        showToast({ severity: 'warn', summary: t('Import'), detail: t('No sheet found in the file.') })
        return
      }
      const sheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      const entries = rawRows
        .map((row) => parseImportRow(row))
        .filter((entry): entry is ExpenseEntryCreatePayload => Boolean(entry))
        .map((entry) => ({ ...entry, eventId: effectiveEventId }))

      if (!entries.length) {
        showToast({ severity: 'warn', summary: t('Import'), detail: t('No valid rows found in the file.') })
        return
      }

      const result = await bulkCreateExpenseEntries({ entries }).unwrap()
      const createdCount = result.created?.length ?? 0
      const errorCount = result.errors?.length ?? 0
      showToast({
        severity: errorCount ? 'warn' : 'success',
        summary: t('Import complete'),
        detail: t('{{createdCount}} row(s) created, {{errorCount}} failed.', { createdCount, errorCount }),
      })
    } catch (error) {
      showToast({ severity: 'error', summary: t('Import failed'), detail: getApiErrorMessage(error) })
    }
  }

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleImportFile(file)
    }
    event.target.value = ''
  }

  const onSubmitNewEvent = async (values: NewEventFormValues) => {
    try {
      const created = await createExpenseEvent({
        name: values.name.trim(),
        startDate: values.startDate.toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
        budget: values.budget,
      }).unwrap()
      showToast({
        severity: 'success',
        summary: t('Event created'),
        detail: t('{{name}} added.', { name: created.name }),
      })
      setIsNewEventOpen(false)
      reset()
      setEventFilter(created._id)
    } catch (error) {
      showToast({ severity: 'error', summary: t('Create failed'), detail: getApiErrorMessage(error) })
    }
  }

  const summary = summaryQuery.data
  const net = summary?.net ?? (summary ? summary.totalIncome - summary.totalExpense : 0)

  return (
    <div className="temple-scope w-full space-y-4">
      <PageHeader
        eyebrow={t('Finance')}
        title={t('Expense Tracker')}
        description={t('Track income and expenses across events or general temple operations.')}
        actions={
          <Button
            type="button"
            label={t('+ New Event')}
            icon={<Plus className="h-4 w-4" />}
            outlined
            onClick={() => setIsNewEventOpen(true)}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('Event')}
          </label>
          <Dropdown
            value={eventFilter}
            options={eventOptions}
            onChange={(e) => setEventFilter(e.value)}
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('Category')}
          </label>
          <InputText
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder={t('Filter by category')}
            className="w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('Year')}
          </label>
          <YearFilter value={year} onChange={handleYearChange} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('From')}
          </label>
          <Calendar
            value={dateFrom}
            onChange={(e) => setDateFrom((e.value as Date) ?? null)}
            dateFormat="dd-mm-yy"
            showButtonBar
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('To')}
          </label>
          <Calendar
            value={dateTo}
            onChange={(e) => setDateTo((e.value as Date) ?? null)}
            dateFormat="dd-mm-yy"
            showButtonBar
            className="w-40"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button
            type="button"
            label={t('Import')}
            icon={<Upload className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            loading={isImporting}
            onClick={() => fileInputRef.current?.click()}
          />
          <Button
            type="button"
            label={t('Export')}
            icon={<Download className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            disabled={!rows.length}
            onClick={handleExport}
          />
        </div>
      </div>

      <EditableGrid<ExpenseEntry>
        columns={columns}
        rows={rows}
        getRowId={(item) => item._id}
        onRowUpdate={handleRowUpdate}
        onRowDelete={handleRowDelete}
        onRowAdd={handleRowAdd}
        loading={entriesQuery.isLoading || entriesQuery.isFetching}
        emptyMessage={t('No expense entries found for the selected filters.')}
        addButtonLabel={t('+ Add Entry')}
        scrollHeight="480px"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Income')}</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {(summary?.totalIncome ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Expense')}</p>
          <p className="mt-1 text-xl font-bold text-red-600">
            {(summary?.totalExpense ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Net')}</p>
          <p className={`mt-1 text-xl font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {net.toLocaleString()}
          </p>
        </div>
      </div>

      <Dialog
        header={t('New Expense Event')}
        visible={isNewEventOpen}
        onHide={() => setIsNewEventOpen(false)}
        style={{ width: 'min(96vw, 32rem)' }}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmitNewEvent)}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--color-text-strong)]">{t('Name')}</label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <InputText
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={t('e.g. Annual Brahmotsavam')}
                  className="w-full"
                />
              )}
            />
            {errors.name ? <span className="text-xs text-red-600">{errors.name.message}</span> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[var(--color-text-strong)]">{t('Start Date')}</label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <Calendar
                    value={field.value}
                    onChange={(e) => field.onChange(e.value as Date)}
                    dateFormat="dd-mm-yy"
                    className="w-full"
                  />
                )}
              />
              {errors.startDate ? <span className="text-xs text-red-600">{errors.startDate.message}</span> : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[var(--color-text-strong)]">{t('End Date')}</label>
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <Calendar
                    value={field.value ?? null}
                    onChange={(e) => field.onChange((e.value as Date) ?? null)}
                    dateFormat="dd-mm-yy"
                    className="w-full"
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--color-text-strong)]">{t('Budget')}</label>
            <Controller
              name="budget"
              control={control}
              render={({ field }) => (
                <InputNumber
                  value={field.value}
                  onValueChange={(e) => field.onChange(e.value ?? 0)}
                  mode="decimal"
                  minFractionDigits={0}
                  className="w-full"
                  inputClassName="w-full"
                />
              )}
            />
            {errors.budget ? <span className="text-xs text-red-600">{errors.budget.message}</span> : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" label={t('Cancel')} severity="secondary" outlined onClick={() => setIsNewEventOpen(false)} />
            <Button type="submit" label={t('Create Event')} loading={isCreatingEvent} />
          </div>
        </form>
      </Dialog>
    </div>
  )
}
