import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Task, TaskCreatePayload, TaskFormValues } from '@/types/task'

export const taskApiDetails = {
  endpoint: '/rcm/tasks',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const taskFormSchema = z.object({
  _id: z.string().optional(),
  entityId: z.string().trim(),
  entityType: z.string().trim(),
  workflowStage: z.string().trim(),
  assignedTo: z.string().trim(),
  assignedTeam: z.string().trim(),
  priority: z.string().trim(),
  status: z.string().trim(),
  dueDate: z.date().nullable(),
  slaTimer: z.date().nullable(),
  escalationFlag: z.boolean(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<TaskFormValues>

export const taskDefaultValues: TaskFormValues = {
  _id: '',
  entityId: '',
  entityType: '',
  workflowStage: '',
  assignedTo: '',
  assignedTeam: '',
  priority: '',
  status: '',
  dueDate: null,
  slaTimer: null,
  escalationFlag: false,
  notes: '',
  active: true,
}

export function createTaskFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<TaskFormValues> {
  void referenceOptions
  return {
    schema: taskFormSchema,
    defaultValues: taskDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'entityId',
      label: 'entity ID',
      type: 'text',
      placeholder: 'entity ID',
    },
    {
      name: 'entityType',
      label: 'entity Type',
      type: 'text',
      placeholder: 'entity Type',
    },
    {
      name: 'workflowStage',
      label: 'workflow Stage',
      type: 'text',
      placeholder: 'workflow Stage',
    },
    {
      name: 'assignedTo',
      label: 'assigned To',
      type: 'text',
      placeholder: 'assigned To',
    },
    {
      name: 'assignedTeam',
      label: 'assigned Team',
      type: 'text',
      placeholder: 'assigned Team',
    },
    {
      name: 'priority',
      label: 'priority',
      type: 'text',
      placeholder: 'priority',
    },
    {
      name: 'status',
      label: 'status',
      type: 'text',
      placeholder: 'status',
    },
    {
      name: 'dueDate',
      label: 'due Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'slaTimer',
      label: 'sla Timer',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'escalationFlag',
      label: 'escalation Flag',
      type: 'switch',
    },
    {
      name: 'notes',
      label: 'notes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'active',
      label: 'active',
      type: 'switch',
    },
    ],
  }
}


export function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function optionalNumber(value: number | null) {
  return typeof value === 'number' ? value : undefined
}

export function optionalDate(value: Date | null) {
  return value ?? undefined
}

export function toFormDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

export function formatDate(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatBoolean(value?: boolean) {
  return value ? 'Yes' : 'No'
}

export function formatNumber(value?: number | null) {
  return typeof value === 'number' ? String(value) : '-'
}

export function parseStringList(value: string) {
  const values = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return values.length ? values : undefined
}

export function formatStringList(value: string[] = []) {
  return value.join('\n')
}

export function formatMixed(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function mapTaskToFormValues(item: Task): TaskFormValues {
  return {
    _id: item._id,
    entityId: item.entityId ?? '',
    entityType: item.entityType ?? '',
    workflowStage: item.workflowStage ?? '',
    assignedTo: item.assignedTo ?? '',
    assignedTeam: item.assignedTeam ?? '',
    priority: item.priority ?? '',
    status: item.status ?? '',
    dueDate: toFormDate(item.dueDate),
    slaTimer: toFormDate(item.slaTimer),
    escalationFlag: item.escalationFlag,
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapTaskFormToPayload(values: TaskFormValues): TaskCreatePayload {
  return {
    entityId: optionalText(values.entityId),
    entityType: optionalText(values.entityType),
    workflowStage: optionalText(values.workflowStage),
    assignedTo: optionalText(values.assignedTo),
    assignedTeam: optionalText(values.assignedTeam),
    priority: optionalText(values.priority),
    status: optionalText(values.status),
    dueDate: optionalDate(values.dueDate),
    slaTimer: optionalDate(values.slaTimer),
    escalationFlag: values.escalationFlag,
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getTaskLabel(item: Task, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.workflowStage, item.status, formatDate(item.dueDate)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createTaskTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Task>> {
  return [
    {
      key: 'record',
      header: 'Task',
      sortField: 'workflowStage',
      exportValue: (item) => getTaskLabel(item, referenceOptions),
      render: (item) => getTaskLabel(item, referenceOptions),
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      field: 'status',
      sortField: 'status',
      exportValue: (item) => item.status ?? '-',
      render: (item) => item.status ?? '-',
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortField: 'updated',
      field: 'updatedAt',
      exportValue: (item) => formatDate(item.updatedAt),
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: 'Updated date',
      },
      render: (item) => formatDate(item.updatedAt),
    },
  ]
}

function renderSection(items: Array<[string, string]>) {
  return (
    <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
        >
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            {label}
          </dt>
          <dd className="whitespace-pre-line break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">
            {value || '-'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function renderTaskDetails(item: Task, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Task</h3>
        {renderSection([
          ['task ID', item.taskId],
          ['entity ID', item.entityId ?? '-'],
          ['entity Type', item.entityType ?? '-'],
          ['workflow Stage', item.workflowStage ?? '-'],
          ['assigned To', item.assignedTo ?? '-'],
          ['assigned Team', item.assignedTeam ?? '-'],
          ['priority', item.priority ?? '-'],
          ['status', item.status ?? '-'],
          ['due Date', formatDate(item.dueDate)],
          ['sla Timer', formatDate(item.slaTimer)],
          ['escalation Flag', formatBoolean(item.escalationFlag)],
          ['notes', item.notes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderTaskGridItem(item: Task, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getTaskLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.status ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
