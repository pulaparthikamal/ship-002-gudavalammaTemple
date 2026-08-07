import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { ServerConnection, ConnectServerPayload } from '@/types/serverManagement'
import { formatDate } from '@/utils/serverManagementFormat'

// ─── Options ────────────────────────────────────────────────────────────────

export const authTypeOptions = [
  { label: 'Password', value: 'password' },
  { label: 'SSH Key', value: 'sshKey' },
]

export const serverStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Connected', value: 'connected' },
  { label: 'Unreachable', value: 'unreachable' },
  { label: 'Disabled', value: 'disabled' },
]

// ─── Form types ──────────────────────────────────────────────────────────────

export interface ServerFormValues {
  _id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'sshKey'
  password: string
  privateKey: string
  pemFile?: File | null
  passphrase: string
  email: string
  verifyConnection: boolean
  scanDirectories: string
}

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const serverFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  host: z.string().trim().min(1, 'Host is required'),
  port: z.coerce
    .number({ message: 'Port must be a number' })
    .int()
    .min(1)
    .max(65535),
  username: z.string().trim().min(1, 'Username is required'),
  authType: z.enum(['password', 'sshKey']),
  password: z.string().optional().default(''),
  privateKey: z.string().optional().default(''),
  pemFile: z.any().optional().nullable(),
  passphrase: z.string().optional().default(''),
  email: z.string().trim().email('Enter a valid email'),
  verifyConnection: z.boolean().optional().default(false),
  scanDirectories: z.string().optional().default('/tmp, /var/log'),
}).superRefine((value, ctx) => {
  if (value.authType === 'password' && !value.password?.trim() && !value._id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Password is required.' })
  }
  if (value.authType === 'sshKey' && !value.privateKey?.trim() && !(value.pemFile instanceof File) && !value._id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['privateKey'], message: 'Paste a private key or upload a PEM file.' })
  }
}) as z.ZodType<ServerFormValues>

export const serverDefaultValues: ServerFormValues = {
  _id: '',
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  pemFile: null,
  passphrase: '',
  email: '',
  verifyConnection: false,
  scanDirectories: '/tmp, /var/log',
}

// ─── Form config ─────────────────────────────────────────────────────────────

export const serverFormConfig: CrudFormConfig<ServerFormValues> = {
  schema: serverFormSchema,
  defaultValues: serverDefaultValues,
  columns: 2,
  fields: [
    { name: '_id', label: 'ID', type: 'hidden' },
    { name: 'name', label: 'Name', type: 'text', placeholder: 'Production API' },
    { name: 'email', label: 'Alert email', type: 'email', placeholder: 'alerts@example.com' },
    { name: 'host', label: 'Host / IP', type: 'text', placeholder: '192.168.1.1' },
    { name: 'port', label: 'Port', type: 'number', min: 1, max: 65535 },
    { name: 'username', label: 'Username', type: 'text', placeholder: 'root' },
    {
      name: 'authType',
      label: 'Authentication',
      type: 'select',
      options: authTypeOptions,
    },
    { name: 'password', label: 'Password', type: 'password', fullWidth: true, visibleIf: (values) => values.authType === 'password' },
    {
      name: 'pemFile',
      label: 'PEM private key file',
      type: 'localFile',
      fullWidth: true,
      helperText: 'Upload a .pem, .key, or .rsa private key. The file is sent directly to the server and encrypted; it is not stored as a public upload.',
      upload: { accept: '.pem,.key,.rsa' },
      visibleIf: (values) => values.authType === 'sshKey',
    },
    {
      name: 'privateKey',
      label: 'Private key',
      type: 'textarea',
      fullWidth: true,
      rows: 5,
      helperText: 'Optional when a PEM file is selected.',
      visibleIf: (values) => values.authType === 'sshKey',
    },
    {
      name: 'passphrase',
      label: 'Passphrase',
      type: 'password',
      fullWidth: true,
      visibleIf: (values) => values.authType === 'sshKey',
    },
    {
      name: 'scanDirectories',
      label: 'Scan directories (comma-separated)',
      type: 'text',
      fullWidth: true,
      placeholder: '/tmp, /var/log',
      helperText: 'Comma-separated list of directories to scan.',
    },
    {
      name: 'verifyConnection',
      label: 'Verify SSH connection before saving',
      type: 'checkbox',
      fullWidth: true,
    },
  ],
}

// ─── Table columns ────────────────────────────────────────────────────────────

function getStatusTone(status: ServerConnection['status']) {
  switch (status) {
    case 'connected':
      return 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
    case 'unreachable':
      return 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
    case 'pending':
      return 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'
    default:
      return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
  }
}

export const serverTableColumns: Array<CrudTableColumn<ServerConnection>> = [
  {
    key: 'name',
    header: 'Server',
    field: 'name',
    sortable: true,
    filter: {
      key: 'nameSearch',
      type: 'regexOr',
      placeholder: 'Search name',
      matchModes: ['contains', 'startsWith', 'endsWith', 'equals'],
    },
    render: (server) => (
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{server.name}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {server.username}@{server.host}:{server.port}
        </p>
      </div>
    ),
  },
  {
    key: 'host',
    header: 'Host',
    field: 'host',
    sortable: true,
    filter: {
      key: 'hostSearch',
      type: 'regexOr',
      placeholder: 'Search host',
      matchModes: ['contains', 'startsWith'],
    },
  },
  {
    key: 'authType',
    header: 'Auth',
    exportValue: (s) => s.authType,
    filter: {
      key: 'authType',
      type: 'in',
      input: 'multiSelect',
      placeholder: 'Auth type',
      options: authTypeOptions,
      matchModes: ['in', 'notIn'],
    },
    render: (server) => (
      <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
        {server.authType === 'sshKey' ? 'SSH Key' : 'Password'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortField: 'status',
    exportValue: (s) => s.status,
    filter: {
      key: 'status',
      type: 'in',
      input: 'multiSelect',
      placeholder: 'Status',
      options: serverStatusOptions,
      matchModes: ['in', 'notIn'],
    },
    render: (server) => (
      <span
        className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatusTone(server.status)}`}
      >
        {server.status}
      </span>
    ),
  },
  {
    key: 'lastConnectedAt',
    header: 'Last connected',
    sortField: 'lastConnectedAt',
    exportValue: (s) => formatDate(s.lastConnectedAt),
    render: (s) => <span className="text-sm text-[var(--color-text-muted)]">{formatDate(s.lastConnectedAt)}</span>,
  },
  {
    key: 'created',
    header: 'Added',
    sortField: 'created',
    exportValue: (s) => formatDate(s.created),
    render: (s) => <span className="text-sm text-[var(--color-text-muted)]">{formatDate(s.created)}</span>,
  },
]

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapServerToFormValues(server: ServerConnection): ServerFormValues {
  return {
    _id: server._id,
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    authType: server.authType,
    password: '',
    privateKey: '',
    pemFile: null,
    passphrase: '',
    email: server.email,
    verifyConnection: false,
    scanDirectories: server.scanDirectories?.length ? server.scanDirectories.join(',') : '/tmp, /var/log',
  }
}

export function mapServerFormToPayload(values: ServerFormValues): ConnectServerPayload {
  return {
    name: values.name.trim(),
    host: values.host.trim(),
    port: Number(values.port) || 22,
    username: values.username.trim(),
    authType: values.authType,
    password: values.password || undefined,
    privateKey: values.privateKey || undefined,
    pemFile: values.pemFile || undefined,
    passphrase: values.passphrase || undefined,
    email: values.email.trim(),
    verifyConnection: values.verifyConnection,
    scanDirectories: values.scanDirectories
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
  }
}

export function renderServerDetails(server: ServerConnection) {
  const rows: [string, string][] = [
    ['Host', `${server.host}:${server.port}`],
    ['Username', server.username],
    ['Auth type', server.authType === 'sshKey' ? 'SSH Key' : 'Password'],
    ['Email', server.email],
    ['Status', server.status],
    ['Last connected', formatDate(server.lastConnectedAt)],
    ['Last metrics', formatDate(server.lastMetricsAt)],
    ['Last scan', formatDate(server.lastScanAt)],
    ['Added', formatDate(server.created)],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{server.name}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {server.username}@{server.host}:{server.port}
          </p>
        </div>
        <span
          className={`inline-flex rounded-lg px-3 py-1 text-sm font-semibold capitalize ${
            server.status === 'connected'
              ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
              : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
          }`}
        >
          {server.status}
        </span>
      </div>

      <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
          >
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {label}
            </dt>
            <dd className="text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
