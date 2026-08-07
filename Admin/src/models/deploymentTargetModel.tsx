import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { Credential, CreateDeploymentTargetPayload, DeploymentTarget } from '@/types/deploymentAgent'
import { formatDate } from '@/utils/serverManagementFormat'

// ─── Options ─────────────────────────────────────────────────────────────────

export const authMethodOptions = [
  { label: 'SSH Key', value: 'sshKey' },
  { label: 'Password', value: 'password' },
]

export const osOptions = [
  { label: 'Ubuntu', value: 'ubuntu' },
  { label: 'Debian', value: 'debian' },
  { label: 'CentOS', value: 'centos' },
  { label: 'RHEL', value: 'rhel' },
  { label: 'Amazon Linux', value: 'amazon-linux' },
]

export const privilegeOptions = [
  { label: 'sudo', value: 'sudo' },
  { label: 'None (run as user)', value: 'none' },
]

export const nodeInstallOptions = [
  { label: 'NVM (recommended)', value: 'nvm' },
  { label: 'apt / yum package manager', value: 'apt' },
  { label: 'Pre-installed', value: 'preinstalled' },
]

export const reverseProxyOptions = [
  { label: 'nginx (managed)', value: 'nginx-managed' },
  { label: 'None', value: 'none' },
]

export const targetStatusOptions = [
  { label: 'Reachable', value: 'reachable' },
  { label: 'Unreachable', value: 'unreachable' },
  { label: 'Unknown', value: 'unknown' },
]

// ─── Form types ───────────────────────────────────────────────────────────────

export interface DeploymentTargetFormValues {
  _id?: string
  name: string
  host: string
  port: number
  username: string
  authMethod: 'password' | 'sshKey'
  credentialId: string
  os: string
  privilegeEscalation: 'sudo' | 'none'
  baseWebRoot: string
  nodeInstallStrategy: 'nvm' | 'apt' | 'preinstalled'
  reverseProxy: 'nginx-managed' | 'none'
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

export const deploymentTargetFormSchema: z.ZodType<DeploymentTargetFormValues> = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  host: z.string().trim().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().min(1, 'Username is required'),
  authMethod: z.enum(['password', 'sshKey']),
  credentialId: z.string().trim().min(1, 'Credential is required'),
  os: z.string().min(1, 'OS is required'),
  privilegeEscalation: z.enum(['sudo', 'none']),
  baseWebRoot: z.string().trim().min(1, 'Base web root is required'),
  nodeInstallStrategy: z.enum(['nvm', 'apt', 'preinstalled']),
  reverseProxy: z.enum(['nginx-managed', 'none']),
})

export const deploymentTargetDefaultValues: DeploymentTargetFormValues = {
  _id: '',
  name: '',
  host: '',
  port: 22,
  username: '',
  authMethod: 'password',
  credentialId: '',
  os: 'ubuntu',
  privilegeEscalation: 'sudo',
  baseWebRoot: '/var/www',
  nodeInstallStrategy: 'preinstalled',
  reverseProxy: 'none',
}

// ─── Form config factory ──────────────────────────────────────────────────────

export function createDeploymentTargetFormConfig(credentials: Credential[]): CrudFormConfig<DeploymentTargetFormValues> {
  const credentialOptions = credentials.map((c) => ({ label: `${c.name} (${c.type})`, value: c._id }))

  return {
    schema: deploymentTargetFormSchema,
    defaultValues: deploymentTargetDefaultValues,
    columns: 2,
    fields: [
      { name: '_id', label: 'ID', type: 'hidden' },
      { name: 'name', label: 'Name', type: 'text', placeholder: 'Production Server' },
      { name: 'host', label: 'Host / IP', type: 'text', placeholder: '192.168.1.100' },
      { name: 'port', label: 'SSH Port', type: 'number', min: 1, max: 65535 },
      { name: 'username', label: 'SSH Username', type: 'text', placeholder: 'ubuntu' },
      { name: 'authMethod', label: 'Auth method', type: 'select', options: authMethodOptions },
      {
        name: 'credentialId',
        label: 'Credential',
        type: 'select',
        options: credentialOptions,
        helperText: 'Select the stored password or SSH key credential.',
      },
      { name: 'os', label: 'Operating System', type: 'select', options: osOptions },
      { name: 'privilegeEscalation', label: 'Privilege escalation', type: 'select', options: privilegeOptions },
      { name: 'baseWebRoot', label: 'Base web root', type: 'text', placeholder: '/var/www', helperText: 'Apps are deployed under this path.' },
      { name: 'nodeInstallStrategy', label: 'Node.js install strategy', type: 'select', options: nodeInstallOptions },
      { name: 'reverseProxy', label: 'Reverse proxy', type: 'select', options: reverseProxyOptions },
    ],
  }
}

// ─── Table columns ────────────────────────────────────────────────────────────

function getStatusTone(status: DeploymentTarget['status']) {
  switch (status) {
    case 'reachable':
      return 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
    case 'unreachable':
      return 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
    default:
      return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
  }
}

export const deploymentTargetTableColumns: Array<CrudTableColumn<DeploymentTarget>> = [
  {
    key: 'name',
    header: 'Target',
    field: 'name',
    sortable: true,
    filter: {
      key: 'nameSearch',
      type: 'regexOr',
      placeholder: 'Search name',
      matchModes: ['contains', 'startsWith'],
    },
    render: (target) => (
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{target.name}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {target.username}@{target.host}:{target.port}
        </p>
      </div>
    ),
  },
  {
    key: 'os',
    header: 'OS',
    field: 'os',
    sortable: true,
    render: (t) => <span className="text-sm capitalize text-[var(--color-text)]">{t.os}</span>,
  },
  {
    key: 'nodeInstallStrategy',
    header: 'Node.js',
    exportValue: (t) => t.nodeInstallStrategy,
    render: (t) => (
      <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
        {t.nodeInstallStrategy}
      </span>
    ),
  },
  {
    key: 'reverseProxy',
    header: 'Proxy',
    exportValue: (t) => t.reverseProxy,
    render: (t) => (
      <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
        {t.reverseProxy}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortField: 'status',
    exportValue: (t) => t.status,
    filter: {
      key: 'status',
      type: 'in',
      input: 'multiSelect',
      placeholder: 'Status',
      options: targetStatusOptions,
      matchModes: ['in', 'notIn'],
    },
    render: (target) => (
      <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatusTone(target.status)}`}>
        {target.status}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Added',
    sortField: 'created',
    exportValue: (t) => formatDate(t.created),
    render: (t) => <span className="text-sm text-[var(--color-text-muted)]">{formatDate(t.created)}</span>,
  },
]

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapTargetToFormValues(target: DeploymentTarget): DeploymentTargetFormValues {
  return {
    _id: target._id,
    name: target.name,
    host: target.host,
    port: target.port,
    username: target.username,
    authMethod: target.authMethod,
    credentialId: target.credentialId,
    os: target.os,
    privilegeEscalation: target.privilegeEscalation,
    baseWebRoot: target.baseWebRoot,
    nodeInstallStrategy: target.nodeInstallStrategy,
    reverseProxy: target.reverseProxy,
  }
}

export function mapTargetFormToPayload(values: DeploymentTargetFormValues): CreateDeploymentTargetPayload {
  return {
    name: values.name.trim(),
    host: values.host.trim(),
    port: Number(values.port) || 22,
    username: values.username.trim(),
    authMethod: values.authMethod,
    credentialId: values.credentialId,
    os: values.os,
    privilegeEscalation: values.privilegeEscalation,
    baseWebRoot: values.baseWebRoot.trim(),
    nodeInstallStrategy: values.nodeInstallStrategy,
    reverseProxy: values.reverseProxy,
  }
}

export function renderTargetDetails(target: DeploymentTarget) {
  const rows: [string, string][] = [
    ['Host', `${target.host}:${target.port}`],
    ['Username', target.username],
    ['Auth method', target.authMethod],
    ['OS', target.os],
    ['Privilege', target.privilegeEscalation],
    ['Web root', target.baseWebRoot],
    ['Node.js strategy', target.nodeInstallStrategy],
    ['Reverse proxy', target.reverseProxy],
    ['Status', target.status],
    ['Added', formatDate(target.created)],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{target.name}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {target.username}@{target.host}:{target.port}
          </p>
        </div>
        <span className={`inline-flex rounded-lg px-3 py-1 text-sm font-semibold capitalize ${
          target.status === 'reachable'
            ? 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
            : target.status === 'unreachable'
            ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
            : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
        }`}>
          {target.status}
        </span>
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
