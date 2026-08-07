import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useGetServersQuery, useActivityListQuery } from '@/services/api/endpoints/serverManagementApi'
import { formatDate } from '@/utils/serverManagementFormat'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'
import type { MaintenanceLog } from '@/types/serverManagement'

function StatusBadge({ status }: { status: string }) {
  const badgeStyles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    skipped: 'bg-slate-50 text-slate-700 ring-slate-200',
    preview: 'bg-sky-50 text-sky-700 ring-sky-200',
  }

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ring-1 ${badgeStyles[status] ?? badgeStyles.preview}`}>
      {status}
    </span>
  )
}

const activityTableColumns = [
  {
    key: 'created',
    header: 'Time',
    render: (log: MaintenanceLog) => formatDate(log.created),
    className: 'whitespace-nowrap',
  },
  {
    key: 'action',
    header: 'Action',
    render: (log: MaintenanceLog) => (
      <span className="font-medium text-[var(--color-text-strong)]">{log.action}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (log: MaintenanceLog) => <StatusBadge status={log.status} />,
  },
  {
    key: 'reason',
    header: 'Reason',
    render: (log: MaintenanceLog) => log.reason,
    className: 'max-w-md',
  },
  {
    key: 'aiDecisionTrace',
    header: 'Trace',
    render: (log: MaintenanceLog) => (
      <span className="text-xs text-[var(--color-text-muted)]">
        {(log.aiDecisionTrace ?? []).slice(0, 3).join(' · ')}
      </span>
    ),
    className: 'max-w-lg',
  },
]

function useActivityListQueryAdapter(query: CrudListQuery, options?: { skip?: boolean }) {
  const serverIdCriterion = query.criteria.find((c) => c.key === 'serverId')
  const serverId = (serverIdCriterion?.value as string) || undefined
  const result = useActivityListQuery({ serverId, limit: query.limit }, options)

  return {
    ...result,
    data: result.data
      ? { data: result.data, total: result.data.length, page: query.page, limit: query.limit }
      : undefined,
  }
}

const dummyMutation = () => [() => ({ unwrap: () => Promise.resolve() }), { isLoading: false }] as any

export function ServerActivityPage() {
  const { data: servers = [] } = useGetServersQuery()

  const config = useMemo<CrudPageConfig<MaintenanceLog, any, any, any>>(() => {
    const serverOptions = servers.map((s) => ({ label: `${s.name} (${s.host})`, value: s._id }))

    return {
      title: 'Activity',
      resourceName: 'activity event',
      eyebrow: 'Activity',
      description: 'Monitor the latest server maintenance events and action history across connected servers.',
      showCreateButton: false,
      emptyMessage: 'No activity recorded for this server.',
      getRowId: (log) => log._id,
      getRowLabel: (log) => log.action,
      table: {
        columns: [
          {
            key: 'server',
            header: 'Server',
            render: (log: MaintenanceLog) => {
              const server = servers.find((s) => s._id === log.server)
              return server ? server.name : log.server
            },
            filter: {
              key: 'serverId',
              type: 'equals',
              input: 'select',
              options: serverOptions,
              placeholder: 'All Servers',
            },
          },
          ...activityTableColumns,
        ],
      },
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'SERVER_AGENT_CONNECT',
      },
      form: { schema: {} as any, defaultValues: {}, fields: [] },
      api: {
        useListQuery: useActivityListQueryAdapter,
        useCreateMutation: dummyMutation,
        useUpdateMutation: dummyMutation,
        useDeleteMutation: dummyMutation,
      },
      mapItemToFormValues: () => ({}),
      mapFormValuesToCreatePayload: () => ({}),
      mapFormValuesToUpdatePayload: () => ({}),
      slots: {
        rowActions: () => [],
      },
    }
  }, [servers])

  return <CrudPage config={config} />
}
