import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { Credential, CreateCredentialPayload } from '@/types/deploymentAgent'
import { formatDate } from '@/utils/serverManagementFormat'

// ─── Options ─────────────────────────────────────────────────────────────────

export const credentialTypeOptions = [
  { label: 'SSH Private Key', value: 'sshKey' },
  { label: 'HTTPS Token', value: 'httpsToken' },
  { label: 'Password', value: 'password' },
]

// ─── Form types ───────────────────────────────────────────────────────────────

export interface CredentialFormValues {
  _id?: string
  name: string
  type: 'sshKey' | 'httpsToken' | 'password'
  value: string
  passphrase: string
  description: string
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

export const credentialFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(['sshKey', 'httpsToken', 'password']),
  value: z.string().optional().default(''),
  passphrase: z.string().optional().default(''),
  description: z.string().optional().default(''),
}).superRefine((val, ctx) => {
  if (!val._id && !val.value?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Secret value is required.' })
  }
}) as z.ZodType<CredentialFormValues>

export const credentialDefaultValues: CredentialFormValues = {
  _id: '',
  name: '',
  type: 'password',
  value: '',
  passphrase: '',
  description: '',
}

// ─── Form config ──────────────────────────────────────────────────────────────

export const credentialFormConfig: CrudFormConfig<CredentialFormValues> = {
  schema: credentialFormSchema,
  defaultValues: credentialDefaultValues,
  columns: 2,
  fields: [
    { name: '_id', label: 'ID', type: 'hidden' },
    { name: 'name', label: 'Name', type: 'text', placeholder: 'prod-deploy-key' },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: credentialTypeOptions,
    },
    {
      name: 'value',
      label: 'Secret value',
      type: 'password',
      fullWidth: true,
      placeholder: 'Enter server password, token, or SSH key',
      helperText: 'Leave blank when editing to keep the existing value.',
    },
    {
      name: 'passphrase',
      label: 'SSH key passphrase (optional)',
      type: 'password',
      fullWidth: true,
      visibleIf: (values) => values.type === 'sshKey',
      helperText: 'Only required if the SSH key is passphrase-protected.',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'text',
      fullWidth: true,
      placeholder: 'Production deploy key for github.com/org/repo',
    },
  ],
}

// ─── Table columns ────────────────────────────────────────────────────────────

function getTypeTone(type: Credential['type']) {
  switch (type) {
    case 'sshKey':
      return 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
    case 'httpsToken':
      return 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
    default:
      return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
  }
}

export const credentialTableColumns: Array<CrudTableColumn<Credential>> = [
  {
    key: 'name',
    header: 'Name',
    field: 'name',
    sortable: true,
    filter: {
      key: 'nameSearch',
      type: 'regexOr',
      placeholder: 'Search name',
      matchModes: ['contains', 'startsWith'],
    },
    render: (credential) => (
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{credential.name}</p>
        {credential.description && (
          <p className="text-[11px] text-[var(--color-text-muted)]">{credential.description}</p>
        )}
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    exportValue: (c) => c.type,
    filter: {
      key: 'type',
      type: 'in',
      input: 'multiSelect',
      placeholder: 'Type',
      options: credentialTypeOptions,
      matchModes: ['in', 'notIn'],
    },
    render: (credential) => (
      <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${getTypeTone(credential.type)}`}>
        {credentialTypeOptions.find((o) => o.value === credential.type)?.label ?? credential.type}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Added',
    sortField: 'created',
    exportValue: (c) => formatDate(c.created),
    render: (c) => <span className="text-sm text-[var(--color-text-muted)]">{formatDate(c.created)}</span>,
  },
]

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapCredentialToFormValues(credential: Credential): CredentialFormValues {
  return {
    _id: credential._id,
    name: credential.name,
    type: credential.type,
    value: '',
    passphrase: '',
    description: credential.description ?? '',
  }
}

export function mapCredentialFormToPayload(values: CredentialFormValues): CreateCredentialPayload {
  return {
    name: values.name.trim(),
    type: values.type,
    value: values.value,
    passphrase: values.passphrase || undefined,
    description: values.description.trim() || undefined,
  }
}

export function renderCredentialDetails(credential: Credential) {
  const rows: [string, string][] = [
    ['Name', credential.name],
    ['Type', credentialTypeOptions.find((o) => o.value === credential.type)?.label ?? credential.type],
    ['Description', credential.description ?? '—'],
    ['Added', formatDate(credential.created)],
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{credential.name}</h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Secret value is encrypted at rest and never returned by the API.</p>
      </div>
      <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
          >
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
            <dd className="text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
