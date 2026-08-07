import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { MaintenanceLog, ServerConnection, ServerLogsPayload } from '@/types/serverManagement'
import { formatDate } from '@/utils/serverManagementFormat'

// ─── Options ────────────────────────────────────────────────────────────────

export const statusOptions = [
    { label: 'Success', value: 'success' },
    { label: 'Failed', value: 'failed' },
    { label: 'Skipped', value: 'skipped' },
    { label: 'Preview', value: 'preview' },
]

export const actionOptions = [
    { label: 'Monitor', value: 'monitor' },
    { label: 'Scan', value: 'scan' },
    { label: 'Alert', value: 'alert' },
    { label: 'Decision', value: 'decision' },
    { label: 'Delete', value: 'delete' },
    { label: 'Archive', value: 'archive' },
    { label: 'Ignore', value: 'ignore' },
    { label: 'Review', value: 'review' }
]

export function getServerOptionLabel(server: Pick<ServerConnection, '_id' | 'host' | 'name' | 'port' | 'username'>) {
    const primaryLabel = server.name?.trim() ? server.name : `${server.username}@${server.host}:${server.port}`
    const secondaryLabel = server.host ? ` (${server.host})` : ''

    return primaryLabel.includes(server.host) ? primaryLabel : `${primaryLabel}${secondaryLabel}`
}

export function createServerOptions(
    servers: Array<Pick<ServerConnection, '_id' | 'host' | 'name' | 'port' | 'username'>>,
) {
    return servers.map((server) => ({
        label: getServerOptionLabel(server),
        value: server._id,
    }))
}


// ─── Form types ──────────────────────────────────────────────────────────────

export interface ServerLogsFormValues {
    _id?: string
    server: string
    action: string
    status: 'success' | 'failed' | 'skipped' | 'preview'
    reason: string
    aiDecisionTrace: string[]
    metadata: Record<string, unknown>
}

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const serverLogsFormSchema = z.object({
    _id: z.string().optional(),
    server: z.string().trim().min(1, 'Server is required'),
    action: z.string().trim().min(1, 'Action is required'),
    status: z.enum(['success', 'failed', 'skipped', 'preview']),
    reason: z.string().trim().optional(),
    aiDecisionTrace: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
}) as z.ZodType<ServerLogsFormValues>

export const serverLogsDefaultValues: ServerLogsFormValues = {
    _id: '',
    server: '',
    action: '',
    status: 'success',
    reason: '',
    aiDecisionTrace: [],
    metadata: {},
}

// ─── Form config ─────────────────────────────────────────────────────────────

export function createServerLogsFormConfig(
    serverOptions: Array<{ label: string; value: string }>,
): CrudFormConfig<ServerLogsFormValues> {
    return {
        schema: serverLogsFormSchema,
        defaultValues: serverLogsDefaultValues,
        columns: 1,
        fields: [
            { name: '_id', label: 'ID', type: 'hidden' },
            {
                name: 'server',
                label: 'Server',
                type: 'select',
                placeholder: 'Select a server',
                options: serverOptions,
            },
            {
                name: 'action',
                label: 'Action',
                type: 'select',
                options: actionOptions,
            },
            {
                name: 'status',
                label: 'Status',
                type: 'select',
                options: statusOptions,
            },
            { name: 'reason', label: 'Reason', type: 'textarea', fullWidth: true, rows: 3 },
        ],
    }
}

// ─── Table columns ────────────────────────────────────────────────────────────

function getStatusTone(status: MaintenanceLog['status']) {
    switch (status) {
        case 'success':
            return 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
        case 'failed':
            return 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
        case 'skipped':
            return 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'
        case 'preview':
            return 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]'
        default:
            return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
    }
}

function getActionTone(action: ServerLogsFormValues['action']) {
    switch (action) {
        case 'monitor':
        case 'decision':
            return 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'

        case 'alert':
        case 'delete':
            return 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'

        case 'scan':
        case 'review':
            return 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'

        case 'archive':
        case 'ignore':
            return 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]'

        default:
            return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
    }
}

export function createServerLogsTableColumns(
    serverOptions: Array<{ label: string; value: string }>,
): Array<CrudTableColumn<MaintenanceLog>> {
    return [
        {
            key: 'server',
            header: 'Server',
            field: 'server',
            sortable: true,
            filter: {
                key: 'server',
                type: 'in',
                input: 'multiSelect',
                placeholder: 'Server',
                options: serverOptions,
                matchModes: ['in', 'notIn'],
            },
            render: (log) => (
                <div>
                    <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                        {log.name || `${log.username}@${log.host}:${log.port}`}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                        {log.username}@{log.host}:{log.port}
                    </p>
                </div>
            ),
        },
        {
            key: 'action',
            header: 'Action',
            field: 'action',
            sortable: true,
            filter: {
                key: 'action',
                type: 'contains',
                input: 'text',
                placeholder: 'Action',
                // options: actionOptions,
                // Using text input for flexible matching of action strings
                matchModes: ['contains'],
            },
            render: (log) => (
                <span
                    className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getActionTone(log.action)}`}
                >
                    {log.action}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortField: 'status',
            exportValue: (l) => l.status,
            filter: {
                key: 'status',
                type: 'in',
                input: 'multiSelect',
                placeholder: 'Status',
                options: statusOptions,
                matchModes: ['in', 'notIn'],
            },
            render: (log) => (
                <span
                    className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatusTone(log.status)}`}
                >
                    {log.status}
                </span>
            ),
        },
        {
            key: 'reason',
            header: 'Reason',
            field: 'reason',
            render: (log) => (
                <div className="max-w-xs truncate text-sm text-[var(--color-text-muted)]" title={log.reason}>
                    {log.reason || '-'}
                </div>
            ),
        },
        {
            key: 'aiDecisionTrace',
            header: 'AI Decision Trace',
            field: 'aiDecisionTrace',
            filter: {
                key: 'aiDecisionTrace',
                type: 'contains',
                input: 'text',
                placeholder: 'Decision Trace',
                matchModes: ['contains'],
            },
            render: (log) => (
                <div
                    className="max-w-xs truncate text-sm text-[var(--color-text-muted)]"
                    title={
                        log.aiDecisionTrace?.length
                            ? log.aiDecisionTrace.map(item => `• ${item}`).join('\n')
                            : '-'
                    }
                >
                    {log.aiDecisionTrace?.length
                        ? log.aiDecisionTrace.join(', ')
                        : '-'}
                </div>
            ),
        },
        {
            key: 'created',
            header: 'Time',
            sortField: 'created',
            exportValue: (l) => formatDate(l.created),
            render: (l) => <span className="text-sm text-[var(--color-text-muted)]">{formatDate(l.created)}</span>,
        },
    ]
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapLogToFormValues(log: MaintenanceLog): ServerLogsFormValues {
    return {
        _id: log._id,
        server: log.server,
        action: log.action,
        status: log.status,
        reason: log.reason || '',
        aiDecisionTrace: log.aiDecisionTrace || [],
        metadata: log.metadata || {},
    }
}

export function mapLogFormToPayload(values: ServerLogsFormValues): ServerLogsPayload {
    return {
        server: values.server.trim(),
        action: values.action.trim(),
        status: values.status,
        reason: values.reason.trim(),
        aiDecisionTrace: values.aiDecisionTrace,
        metadata: values.metadata,
    }
}

export function renderLogDetails(log: MaintenanceLog) {
    const rows: [string, string][] = [
        ['Server', log.name || log.server],
        ['Action', log.action],
        ['Status', log.status],
        ['Time', formatDate(log.created)],
        ['Reason', log.reason || '-'],
    ]

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{log.action}</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Server: {log.name || `${log.username}@${log.host}:${log.port}`}
                    </p>
                </div>
                <span
                    className={`inline-flex rounded-lg px-3 py-1 text-sm font-semibold capitalize ${getStatusTone(log.status)}`}
                >
                    {log.status}
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
                {log.aiDecisionTrace && log.aiDecisionTrace.length > 0 && (
                    <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                        <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)] mb-2">
                            AI Decision Trace
                        </dt>
                        <dd className="text-sm text-[var(--color-text-strong)]">
                            <ul className="list-disc pl-5 space-y-1">
                                {log.aiDecisionTrace.map((trace, i) => (
                                    <li key={i}>{trace}</li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                )}
            </dl>
        </div>
    )
}
