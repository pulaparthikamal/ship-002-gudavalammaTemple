import { useState, useCallback, useEffect } from 'react'
import { z } from 'zod'
import { Check, Copy, RefreshCw, Webhook, Mail, Plus, Trash2 } from 'lucide-react'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { Application, CreateApplicationPayload, Credential, IComponent } from '@/types/deploymentAgent'
import { formatDate } from '@/utils/serverManagementFormat'
import { AUTH_BASE_URL } from '@/services/api/apiConfig'
import { useToast } from '@/hooks/useToast'
import {
  useRotateWebhookSecretMutation,
  useUpdateAutoDeployMutation,
  useGetDeploymentTargetsQuery,
  useUpdateApplicationMutation,
} from '@/services/api/endpoints/deploymentAgentApi'

// ─── Options ─────────────────────────────────────────────────────────────────

export const layoutOptions = [
  { label: 'Monorepo (all components in one repo)', value: 'monorepo' },
  { label: 'Multi-repo (each component has its own repo)', value: 'multi-repo' },
]

export const providerOptions = [
  { label: 'GitHub', value: 'github' },
  { label: 'GitLab', value: 'gitlab' },
  { label: 'Bitbucket', value: 'bitbucket' },
  { label: 'Custom / Self-hosted', value: 'custom' },
]

export const repoAuthOptions = [
  { label: 'Public (no auth)', value: 'public' },
  { label: 'HTTPS Token', value: 'httpsToken' },
  { label: 'SSH Key', value: 'sshKey' },
]

export const componentTypeOptions = [
  { label: 'Node.js API (PM2)', value: 'node-api' },
  { label: 'React / Static UI (nginx)', value: 'react-ui' },
  { label: 'Static files (nginx)', value: 'static' },
]

// ─── Form types ───────────────────────────────────────────────────────────────

export interface ApplicationFormValues {
  _id?: string
  name: string
  layout: 'monorepo' | 'multi-repo'
  repoUrl: string
  repoProvider: 'github' | 'gitlab' | 'bitbucket' | 'custom'
  repoAuthMethod: 'public' | 'httpsToken' | 'sshKey'
  repoCredentialId: string
  repoBranch: string
  compKey: string
  compType: 'node-api' | 'react-ui' | 'static'
  compSourcePath: string
  compRepoUrl: string
  compNodeVersion: string
  compInstallCommand: string
  compBuildCommand: string
  compBuildOutputDir: string
  compStartCommand: string
  compPort: number | ''
  compHealthCheckUrl: string
  applicationPath: string
  alertEmail?: string
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

export const applicationFormSchema: z.ZodType<ApplicationFormValues> = z
  .object({
    _id: z.string().optional(),
    name: z.string().trim().min(1, 'Application name is required'),
    layout: z.enum(['monorepo', 'multi-repo']),
    repoUrl: z.string().trim().url('Enter a valid repository URL'),
    repoProvider: z.enum(['github', 'gitlab', 'bitbucket', 'custom']),
    repoAuthMethod: z.enum(['public', 'httpsToken', 'sshKey']),
    repoCredentialId: z.string().optional().default(''),
    repoBranch: z.string().trim().min(1, 'Branch is required'),
    compKey: z.string().trim().min(1, 'Component key is required'),
    compType: z.enum(['node-api', 'react-ui', 'static']),
    compSourcePath: z.string().optional().default(''),
    compRepoUrl: z.string().optional().default(''),
    compNodeVersion: z.string().optional().default(''),
    compInstallCommand: z.string().optional().default(''),
    compBuildCommand: z.string().optional().default(''),
    compBuildOutputDir: z.string().optional().default(''),
    compStartCommand: z.string().optional().default(''),
    compPort: z.union([z.coerce.number().int().min(1).max(65535), z.literal('')]).optional().default(''),
    compHealthCheckUrl: z.string().optional().default(''),
    applicationPath: z.string().optional().default(''),
    alertEmail: z.string().trim().email('Enter a valid email address').or(z.literal('')).optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (val.repoAuthMethod !== 'public' && !val.repoCredentialId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repoCredentialId'], message: 'Credential is required for private repositories.' })
    }
    if (val.layout === 'multi-repo' && !val.compRepoUrl?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compRepoUrl'], message: 'Component repo URL is required for multi-repo layout.' })
    }
  })

export const applicationDefaultValues: ApplicationFormValues = {
  _id: '',
  name: '',
  layout: 'monorepo',
  repoUrl: '',
  repoProvider: 'github',
  repoAuthMethod: 'public',
  repoCredentialId: '',
  repoBranch: 'main',
  compKey: 'api',
  compType: 'node-api',
  compSourcePath: '',
  compRepoUrl: '',
  compNodeVersion: '20',
  compInstallCommand: '',
  compBuildCommand: '',
  compBuildOutputDir: 'dist',
  compStartCommand: '',
  compPort: '',
  compHealthCheckUrl: '/health',
  applicationPath: '',
  alertEmail: '',
}

// ─── Form config factory ──────────────────────────────────────────────────────

export function createApplicationFormConfig(credentials: Credential[]): CrudFormConfig<ApplicationFormValues> {
  const credentialOptions = credentials.map((c) => ({ label: `${c.name} (${c.type})`, value: c._id }))

  return {
    schema: applicationFormSchema,
    defaultValues: applicationDefaultValues,
    columns: 2,
    fields: [
      { name: '_id', label: 'ID', type: 'hidden' },

      // ── Application section ────────────────────────────────────────────────
      { name: 'name', label: 'Application name', type: 'text', placeholder: 'my-app', section: 'Application' },
      { name: 'layout', label: 'Repository layout', type: 'select', options: layoutOptions, section: 'Application' },
      {
        name: 'alertEmail',
        label: 'Alert Email',
        type: 'text',
        placeholder: 'alerts@example.com',
        section: 'Application',
        helperText: 'A deployment alert/notification email address (e.g. Gmail) where deployment status updates are sent.',
      },

      // ── Repository section ────────────────────────────────────────────────
      {
        name: 'repoUrl',
        label: 'Repository URL',
        type: 'text',
        fullWidth: true,
        placeholder: 'https://github.com/org/repo.git',
        section: 'Repository',
        helperText: 'For monorepo: the single repo. For multi-repo: the primary/shared repo.',
      },
      { name: 'repoProvider', label: 'Provider', type: 'select', options: providerOptions, section: 'Repository' },
      { name: 'repoAuthMethod', label: 'Authentication', type: 'select', options: repoAuthOptions, section: 'Repository' },
      {
        name: 'repoCredentialId',
        label: 'Credential',
        type: 'select',
        options: credentialOptions,
        section: 'Repository',
        visibleIf: (v) => v.repoAuthMethod !== 'public',
        helperText: 'Select the HTTPS token or SSH key credential.',
      },
      { name: 'repoBranch', label: 'Branch', type: 'text', placeholder: 'main', section: 'Repository' },
      {
        name: 'applicationPath',
        label: 'Application path',
        type: 'text',
        placeholder: 'apps/backend',
        section: 'Repository',
        helperText: 'Application Path is required when the application is located in a subfolder of the repository.',
      },

      // ── Component section ─────────────────────────────────────────────────
      {
        name: 'compKey',
        label: 'Component key',
        type: 'text',
        placeholder: 'api',
        section: 'Primary Component',
        helperText: 'Short slug used in paths and PM2 app names (e.g. api, ui).',
      },
      { name: 'compType', label: 'Component type', type: 'select', options: componentTypeOptions, section: 'Primary Component' },
      {
        name: 'compSourcePath',
        label: 'Source path (monorepo)',
        type: 'text',
        placeholder: 'packages/api',
        section: 'Primary Component',
        visibleIf: (v) => v.layout === 'monorepo',
        helperText: 'Relative path inside the repo to this component\'s root.',
      },
      {
        name: 'compRepoUrl',
        label: 'Component repo URL',
        type: 'text',
        placeholder: 'https://github.com/org/api.git',
        section: 'Primary Component',
        visibleIf: (v) => v.layout === 'multi-repo',
        helperText: 'The separate repository for this component.',
      },
      {
        name: 'compNodeVersion',
        label: 'Node.js version',
        type: 'text',
        placeholder: '20',
        section: 'Primary Component',
        visibleIf: (v) => v.compType !== 'static',
      },
      {
        name: 'compInstallCommand',
        label: 'Install command',
        type: 'text',
        placeholder: 'npm ci',
        section: 'Primary Component',
        visibleIf: (v) => v.compType !== 'static',
        helperText: 'Leave blank to use npm ci (or fallback to npm install).',
      },
      {
        name: 'compBuildCommand',
        label: 'Build command',
        type: 'text',
        placeholder: 'npm run build',
        section: 'Primary Component',
        visibleIf: (v) => v.compType === 'react-ui',
      },
      {
        name: 'compBuildOutputDir',
        label: 'Build output directory',
        type: 'text',
        placeholder: 'dist',
        section: 'Primary Component',
        visibleIf: (v) => v.compType === 'react-ui',
      },
      {
        name: 'compStartCommand',
        label: 'Start command',
        type: 'text',
        placeholder: 'node dist/index.js',
        section: 'Primary Component',
        visibleIf: (v) => v.compType === 'node-api',
      },
      {
        name: 'compPort',
        label: 'Port',
        type: 'number',
        min: 1,
        max: 65535,
        section: 'Primary Component',
        visibleIf: (v) => v.compType === 'node-api',
      },
      {
        name: 'compHealthCheckUrl',
        label: 'Health check URL',
        type: 'text',
        placeholder: 'http://127.0.0.1:3000/health or /health',
        section: 'Primary Component',
        visibleIf: (v) => v.compType === 'node-api',
        helperText: 'A full URL or a relative path (e.g. /health) to verify your application\'s status.',
      },
    ],
  }
}

// ─── Webhook URL cell ─────────────────────────────────────────────────────────

function WebhookUrlCell({ url, autoDeployEnabled }: { url: string; autoDeployEnabled?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [url])

  const display = url//.replace(/^https?:\/\/[^/]+/, '').replace('/api/v1/deploymentAgent/webhooks/github/', '…/')

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Webhook size={11} className="shrink-0 text-indigo-400" />
        <span className="max-w-[160px] truncate font-mono text-[11px] text-[var(--color-text-muted)]" title={url}>
          {display}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy webhook URL"
          className="shrink-0 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
        </button>
      </div>
      {autoDeployEnabled && (
        <span className="inline-flex w-fit items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          auto-deploy on
        </span>
      )}
    </div>
  )
}

// ─── Table columns ────────────────────────────────────────────────────────────

export const applicationTableColumns: Array<CrudTableColumn<Application>> = [
  {
    key: 'name',
    header: 'Application',
    field: 'name',
    sortable: true,
    filter: {
      key: 'nameSearch',
      type: 'regexOr',
      placeholder: 'Search name',
      matchModes: ['contains', 'startsWith'],
    },
    render: (app) => (
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{app.name}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{app.components.length} component{app.components.length !== 1 ? 's' : ''}</p>
      </div>
    ),
  },
  {
    key: 'layout',
    header: 'Layout',
    exportValue: (a) => a.layout,
    render: (app) => (
      <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold capitalize text-[var(--color-text)]">
        {app.layout}
      </span>
    ),
  },
  {
    key: 'repository',
    header: 'Repository',
    render: (app) => (
      <span className="max-w-[200px] truncate text-sm text-[var(--color-text-muted)]">
        {app.repository.url}
      </span>
    ),
  },
  {
    key: 'branch',
    header: 'Branch',
    render: (app) => (
      <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-text)]">
        {app.repository.branch}
      </span>
    ),
  },
  {
    key: 'webhook',
    header: 'Webhook',
    exportValue: (a) => a.webhookUrl ?? '',
    render: (app) => {
      if (!app.webhookUrl) return <span className="text-[11px] text-[var(--color-text-muted)]">—</span>
      return <WebhookUrlCell url={AUTH_BASE_URL + app.webhookUrl} autoDeployEnabled={app.autoDeploy?.enabled} />
    },
  },
  {
    key: 'created',
    header: 'Added',
    sortField: 'created',
    exportValue: (a) => formatDate(a.created),
    render: (a) => <span className="text-sm text-[var(--color-text-muted)]">{formatDate(a.created)}</span>,
  },
]

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapApplicationToFormValues(app: Application): ApplicationFormValues {
  const comp = app.components[0] as IComponent | undefined
  return {
    _id: app._id,
    name: app.name,
    layout: app.layout,
    repoUrl: app.repository.url,
    repoProvider: app.repository.provider,
    repoAuthMethod: app.repository.authMethod,
    repoCredentialId: app.repository.credentialId ?? '',
    repoBranch: app.repository.branch,
    compKey: comp?.key ?? 'api',
    compType: comp?.type ?? 'node-api',
    compSourcePath: comp?.sourcePath ?? '',
    compRepoUrl: comp?.repoUrl ?? '',
    compNodeVersion: comp?.nodeVersion ?? '20',
    compInstallCommand: comp?.installCommand ?? '',
    compBuildCommand: comp?.buildCommand ?? '',
    compBuildOutputDir: comp?.buildOutputDir ?? 'dist',
    compStartCommand: comp?.startCommand ?? '',
    compPort: comp?.port ?? '',
    compHealthCheckUrl: comp?.healthCheckUrl || comp?.healthCheckPath || '',
    applicationPath: (app as any).applicationPath ?? '',
    alertEmail: app.alertEmail ?? '',
  }
}

export function mapApplicationFormToPayload(values: ApplicationFormValues): CreateApplicationPayload {
  const component: IComponent = {
    key: values.compKey.trim(),
    type: values.compType,
    sourcePath: values.layout === 'monorepo' ? values.compSourcePath.trim() || undefined : undefined,
    repoUrl: values.layout === 'multi-repo' ? values.compRepoUrl.trim() || undefined : undefined,
    nodeVersion: values.compNodeVersion.trim() || undefined,
    installCommand: values.compInstallCommand.trim() || undefined,
    buildCommand: values.compBuildCommand.trim() || undefined,
    buildOutputDir: values.compBuildOutputDir.trim() || undefined,
    startCommand: values.compStartCommand.trim() || undefined,
    port: values.compPort !== '' ? Number(values.compPort) : undefined,
    healthCheckUrl: values.compHealthCheckUrl.trim() || undefined,
  }

  return {
    name: values.name.trim(),
    layout: values.layout,
    repository: {
      url: values.repoUrl.trim(),
      provider: values.repoProvider,
      authMethod: values.repoAuthMethod,
      credentialId: values.repoAuthMethod !== 'public' ? values.repoCredentialId : undefined,
      branch: values.repoBranch.trim(),
    },
    components: [component],
    applicationPath: values.applicationPath?.trim() || undefined,
    alertEmail: values.alertEmail?.trim() || undefined,
  }
}

// ─── Webhook config section ───────────────────────────────────────────────────

function AppWebhookConfig({ app }: { app: Application }) {
  const [rotateSecret, { isLoading: rotating }] = useRotateWebhookSecretMutation()
  const [updateAutoDeploy, { isLoading: saving }] = useUpdateAutoDeployMutation()
  const { data: targets = [] } = useGetDeploymentTargetsQuery()
  const { showToast } = useToast()

  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [autoDeployEnabled, setAutoDeployEnabled] = useState(app.autoDeploy?.enabled ?? false)
  const [autoDeployTargetId, setAutoDeployTargetId] = useState(app.autoDeploy?.targetId ?? '')
  const [autoDeployBranch, setAutoDeployBranch] = useState(app.autoDeploy?.branch ?? app.repository.branch ?? 'main')

  // Sync local state when the app record is updated (e.g. after a successful save refetches the list)
  useEffect(() => {
    setAutoDeployEnabled(app.autoDeploy?.enabled ?? false)
    setAutoDeployTargetId(app.autoDeploy?.targetId ?? '')
    setAutoDeployBranch(app.autoDeploy?.branch ?? app.repository.branch ?? 'main')
  }, [app.autoDeploy?.enabled, app.autoDeploy?.targetId, app.autoDeploy?.branch, app.repository.branch])

  const handleRotate = useCallback(async () => {
    try {
      const result = await rotateSecret(app._id).unwrap()
      setNewSecret(result.secret)
    } catch {
      showToast({ severity: 'error', summary: 'Failed to rotate webhook secret' })
    }
  }, [rotateSecret, app._id, showToast])

  const handleCopy = useCallback(() => {
    if (!newSecret) return
    navigator.clipboard.writeText(newSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [newSecret])

  const handleSaveAutoDeploy = useCallback(async () => {
    try {
      await updateAutoDeploy({
        id: app._id,
        data: {
          enabled: autoDeployEnabled,
          targetId: autoDeployTargetId || undefined,
          branch: autoDeployBranch,
        },
      }).unwrap()
      showToast({ severity: 'success', summary: 'Auto-deploy settings saved' })
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { message?: string } }).data?.message
        : undefined
      showToast({ severity: 'error', summary: 'Failed to save auto-deploy settings', detail })
    }
  }, [updateAutoDeploy, app._id, autoDeployEnabled, autoDeployTargetId, autoDeployBranch, showToast])

  const webhookUrl = (() => {
    const raw = app.webhookUrl || ''
    if (!raw || /^https?:\/\//i.test(raw)) return raw
    const base = /^https?:\/\//i.test(AUTH_BASE_URL) ? AUTH_BASE_URL : window.location.origin
    return `${base}${raw}`
  })()

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-2">
        <Webhook size={15} className="text-[var(--color-primary)]" />
        <h4 className="text-sm font-semibold text-[var(--color-text-strong)]">GitHub Auto-Deploy (Webhook)</h4>
      </div>

      {/* Webhook URL */}
      {webhookUrl && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">Payload URL</p>
          <div className="flex items-center gap-2 rounded-md bg-[var(--color-surface-muted)] px-3 py-2">
            <code className="flex-1 break-all font-mono text-xs text-[var(--color-text-strong)]">{webhookUrl}</code>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(webhookUrl) }}
              className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              title="Copy URL"
            >
              <Copy size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Secret rotation */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
          Webhook Secret {app.hasWebhookSecret ? '(configured)' : '(not configured)'}
        </p>
        {newSecret ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
              <code className="flex-1 font-mono text-xs text-amber-900 dark:text-amber-200">{newSecret}</code>
              <button type="button" onClick={handleCopy} className="shrink-0" title="Copy secret">
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-amber-700 dark:text-amber-300" />}
              </button>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Copy this now — it will not be shown again.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRotate}
            disabled={rotating}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            <RefreshCw size={12} className={rotating ? 'animate-spin' : ''} />
            {rotating ? 'Rotating…' : app.hasWebhookSecret ? 'Rotate secret' : 'Generate secret'}
          </button>
        )}
      </div>

      {/* Auto-deploy settings */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <p className="mb-3 text-xs font-semibold text-[var(--color-text-muted)]">Auto-Deploy Settings</p>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={autoDeployEnabled}
              onChange={(e) => setAutoDeployEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-sm text-[var(--color-text-strong)]">Enable auto-deploy on push</span>
          </label>

          {autoDeployEnabled && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Target server</label>
                <select
                  value={autoDeployTargetId}
                  onChange={(e) => setAutoDeployTargetId(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Select target server…</option>
                  {targets.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} ({t.host})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Branch to watch</label>
                <input
                  type="text"
                  value={autoDeployBranch}
                  onChange={(e) => setAutoDeployBranch(e.target.value)}
                  placeholder="main"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleSaveAutoDeploy}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save auto-deploy settings'}
          </button>
        </div>
      </div>

      {/* GitHub setup instructions */}
      {webhookUrl && (
        <div className="border-t border-[var(--color-border)] pt-4">
          <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">GitHub Setup</p>
          <ol className="space-y-1 text-xs text-[var(--color-text-muted)]">
            <li>1. Go to your repo → Settings → Webhooks → Add webhook</li>
            <li>2. Paste the Payload URL above</li>
            <li>3. Content type: <code className="font-mono">application/json</code></li>
            <li>4. Paste the Secret from "Rotate secret" above</li>
            <li>5. Events: "Just the push event"</li>
            <li>6. Verify the green ✓ on the ping delivery</li>
          </ol>
        </div>
      )}
    </div>
  )
}

function AppNotificationConfig({ app }: { app: Application }) {
  const [updateApplication, { isLoading: saving }] = useUpdateApplicationMutation()
  const { showToast } = useToast()

  const [notifyOnStart, setNotifyOnStart] = useState(app.notificationSettings?.notifyOnStart ?? true)
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(app.notificationSettings?.notifyOnSuccess ?? true)
  const [notifyOnFailure, setNotifyOnFailure] = useState(app.notificationSettings?.notifyOnFailure ?? true)
  const [notifyOnRollback, setNotifyOnRollback] = useState(app.notificationSettings?.notifyOnRollback ?? true)
  const [recipients, setRecipients] = useState<string[]>(app.notificationSettings?.additionalRecipients ?? [])
  const [emailInput, setEmailInput] = useState('')
  const [alertEmail, setAlertEmail] = useState(app.alertEmail ?? '')

  // Sync state with incoming updates
  useEffect(() => {
    setNotifyOnStart(app.notificationSettings?.notifyOnStart ?? true)
    setNotifyOnSuccess(app.notificationSettings?.notifyOnSuccess ?? true)
    setNotifyOnFailure(app.notificationSettings?.notifyOnFailure ?? true)
    setNotifyOnRollback(app.notificationSettings?.notifyOnRollback ?? true)
    setRecipients(app.notificationSettings?.additionalRecipients ?? [])
    setAlertEmail(app.alertEmail ?? '')
  }, [app.notificationSettings, app.alertEmail])

  const handleAddRecipient = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    
    // Simple email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showToast({ severity: 'error', summary: 'Invalid Email Address' })
      return
    }

    if (recipients.includes(email)) {
      showToast({ severity: 'warn', summary: 'Email already added' })
      return
    }

    setRecipients([...recipients, email])
    setEmailInput('')
  }

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((r) => r !== emailToRemove))
  }

  const handleSave = async () => {
    try {
      if (alertEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)) {
        showToast({ severity: 'error', summary: 'Invalid Alert Email', detail: 'Please enter a valid email address.' })
        return
      }

      await updateApplication({
        id: app._id,
        data: {
          alertEmail,
          notificationSettings: {
            notifyOnStart,
            notifyOnSuccess,
            notifyOnFailure,
            notifyOnRollback,
            additionalRecipients: recipients,
          },
        },
      }).unwrap()
      showToast({ severity: 'success', summary: 'Notification settings saved successfully' })
    } catch (err: any) {
      showToast({ severity: 'error', summary: 'Failed to save notification settings', detail: err?.data?.message })
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-2">
        <Mail size={15} className="text-[var(--color-primary)]" />
        <h4 className="text-sm font-semibold text-[var(--color-text-strong)]">Email Notifications</h4>
      </div>

      <div className="space-y-2 border-b border-[var(--color-border)] pb-3">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">Event Preferences</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={notifyOnStart}
              onChange={(e) => setNotifyOnStart(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-sm text-[var(--color-text-strong)]">Deployment Started</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={notifyOnSuccess}
              onChange={(e) => setNotifyOnSuccess(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-sm text-[var(--color-text-strong)]">Deployment Success</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={notifyOnFailure}
              onChange={(e) => setNotifyOnFailure(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-sm text-[var(--color-text-strong)]">Deployment Failure</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={notifyOnRollback}
              onChange={(e) => setNotifyOnRollback(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-sm text-[var(--color-text-strong)]">Deployment Rollback</span>
          </label>
        </div>
      </div>

      <div className="space-y-1.5 border-b border-[var(--color-border)] pb-3">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">Notification / Alert Email (e.g. Gmail)</p>
        <input
          type="email"
          value={alertEmail}
          onChange={(e) => setAlertEmail(e.target.value)}
          placeholder="your-gmail-or-alert-email@gmail.com"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <p className="text-[11px] text-[var(--color-text-muted)]">
          All deployment life cycle email updates will be sent directly to this address.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">Additional Notification Recipients</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRecipient(); } }}
            placeholder="colleague@company.com"
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={handleAddRecipient}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {recipients.length > 0 ? (
          <ul className="mt-2.5 max-h-36 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 divide-y divide-[var(--color-border)]">
            {recipients.map((email) => (
              <li key={email} className="flex items-center justify-between py-2 text-sm text-[var(--color-text-strong)]">
                <span className="truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email)}
                  className="text-red-500 hover:text-red-700"
                  title="Remove recipient"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-text-muted)] italic">No additional recipients configured. Only the project owner and the alert email above will be notified.</p>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save notification settings'}
        </button>
      </div>
    </div>
  )
}

export function renderApplicationDetails(app: Application) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{app.name}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{app.repository.url}</p>
        </div>
        <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-3 py-1 text-sm font-semibold capitalize text-[var(--color-text)]">
          {app.layout}
        </span>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Repository</h4>
        <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          {([
            ['URL', app.repository.url],
            ['Provider', app.repository.provider],
            ['Auth', app.repository.authMethod],
            ['Branch', app.repository.branch],
            ...(app.applicationPath ? [['Application path', app.applicationPath]] as [string, string][] : []),
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:items-center">
              <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
              <dd className="break-all text-sm font-medium text-[var(--color-text-strong)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Components ({app.components.length})
        </h4>
        <div className="space-y-3">
          {app.components.map((comp) => (
            <div key={comp.key} className="rounded-lg border border-[var(--color-border)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-[var(--color-text-strong)]">{comp.key}</span>
                <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                  {comp.type}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {comp.sourcePath && <><dt className="text-[var(--color-text-muted)]">Source path</dt><dd className="font-mono">{comp.sourcePath}</dd></>}
                {comp.nodeVersion && <><dt className="text-[var(--color-text-muted)]">Node.js</dt><dd>{comp.nodeVersion}</dd></>}
                {comp.port && <><dt className="text-[var(--color-text-muted)]">Port</dt><dd>{comp.port}</dd></>}
                {comp.healthCheckUrl && <><dt className="text-[var(--color-text-muted)]">Health check URL</dt><dd className="font-mono">{comp.healthCheckUrl}</dd></>}
                {!comp.healthCheckUrl && comp.healthCheckPath && <><dt className="text-[var(--color-text-muted)]">Health check path</dt><dd className="font-mono">{comp.healthCheckPath}</dd></>}
                {comp.buildCommand && <><dt className="text-[var(--color-text-muted)]">Build</dt><dd className="font-mono">{comp.buildCommand}</dd></>}
                {comp.startCommand && <><dt className="text-[var(--color-text-muted)]">Start</dt><dd className="font-mono">{comp.startCommand}</dd></>}
              </dl>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook / Auto-deploy configuration */}
      <AppWebhookConfig app={app} />

      {/* Notification Preferences */}
      <AppNotificationConfig app={app} />

      <p className="text-xs text-[var(--color-text-muted)]">Added {formatDate(app.created)}</p>
    </div>
  )
}
