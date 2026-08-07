import { useState, useMemo } from 'react'
import {
  Filter,
  RefreshCw,
  Server,
  AlertTriangle,
  CheckCircle,
  Calendar
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  useGetApplicationsQuery,
  useGetNotificationsReportQuery,
} from '@/services/api/endpoints/deploymentAgentApi'
import { cn } from '@/utils/classNames'
import { useToast } from '@/hooks/useToast'
import { CommonTable } from '@/components/crud/CommonTable'
import { Paginator } from 'primereact/paginator'
import type { CrudListQuery, CrudTableColumn } from '@/types/crud'

export function NotificationsLogsPage() {
  const { showToast } = useToast()
  
  // State
  const [applicationId, setApplicationId] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(20)
  const [selectedError, setSelectedError] = useState<string | null>(null)

  // Dropdown options
  const { data: applications = [] } = useGetApplicationsQuery()

  // API query
  const queryParams = useMemo(() => ({
    applicationId: applicationId || undefined,
    status: status || undefined,
    page,
    limit,
  }), [applicationId, status, page, limit])

  const { data: logsData, isLoading, isFetching, refetch } = useGetNotificationsReportQuery(queryParams)

  const handleRefresh = () => {
    refetch()
    showToast({ severity: 'success', summary: 'Refreshed', detail: 'Notification logs updated successfully.' })
  }

  const items = logsData?.items || []
  const totalItems = logsData?.total || 0

  const query = useMemo<CrudListQuery>(() => ({
    page,
    limit,
    criteria: []
  }), [page, limit])

  const handleQueryChange = (newQuery: CrudListQuery) => {
    setPage(newQuery.page)
    setLimit(newQuery.limit)
  }

  const handlePageChange = (event: { first: number; rows: number }) => {
    setPage(Math.floor(event.first / event.rows) + 1)
    setLimit(event.rows)
  }

  const columns: Array<CrudTableColumn<any>> = useMemo(() => [
    {
      key: 'application',
      header: 'Application / Target',
      sortable: false,
      render: (log) => (
        <div>
          <div className="font-semibold text-[var(--color-text-strong)]">{log.appName}</div>
          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
            <Server className="h-3.5 w-3.5" />
            {log.serverName}
          </div>
        </div>
      ),
      className: 'min-w-[180px]',
    },
    {
      key: 'version',
      header: 'Version',
      sortable: false,
      render: (log) => (
        <span className="text-[var(--color-text-strong)] font-mono text-xs">
          Commit: {log.version}
        </span>
      ),
      className: 'min-w-[150px]',
    },
    {
      key: 'recipient',
      header: 'Recipient / Event Type',
      sortable: false,
      render: (log) => (
        <div>
          <div className="text-[var(--color-text-strong)] font-medium max-w-[180px] truncate" title={log.recipient}>
            {log.recipient}
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold mt-1 capitalize',
              log.eventType === 'success' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400',
              log.eventType === 'failure' && 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400',
              log.eventType === 'rollback' && 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
              log.eventType === 'start' && 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400'
            )}
          >
            {log.eventType}
          </span>
        </div>
      ),
      className: 'min-w-[180px]',
    },
    {
      key: 'subject',
      header: 'Subject',
      sortable: false,
      render: (log) => (
        <span className="text-[var(--color-text-strong)] font-medium max-w-[200px] truncate block" title={log.subject}>
          {log.subject}
        </span>
      ),
      className: 'min-w-[200px]',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: false,
      render: (log) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
            log.status === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400'
              : 'bg-rose-500/10 text-rose-700 ring-rose-600/20 dark:text-rose-400'
          )}
        >
          {log.status === 'success' ? 'Sent' : 'Failed'}
        </span>
      ),
    },
    {
      key: 'dateSent',
      header: 'Date Sent',
      sortable: false,
      render: (log) => (
        <div className="flex items-center gap-1 text-[var(--color-text-muted)] text-xs">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(log.sentAt).toLocaleString()}
        </div>
      ),
      className: 'min-w-[160px]',
    },
    {
      key: 'diagnostics',
      header: 'Diagnostics',
      className: 'text-right justify-end',
      headerClassName: 'text-right',
      render: (log) => (
        <div className="flex justify-end pr-2">
          {log.status === 'failed' ? (
            <button
              onClick={() => setSelectedError(log.errorMessage || 'Unknown email delivery error.')}
              className="text-rose-500 hover:text-rose-700 transition-colors p-1 hover:bg-rose-500/10 rounded"
              title="View diagnostic details"
            >
              <AlertTriangle size={15} />
            </button>
          ) : (
            <div className="text-[var(--color-text-muted)] text-xs flex justify-end pr-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
          )}
        </div>
      ),
    },
  ], [setSelectedError])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Deployment Agent"
          title="Notification Logs"
          description="Track the status of automatic email alerts sent during deployment starts, successes, failures, or rollbacks."
        />
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50 self-start sm:self-center"
        >
          <RefreshCw size={16} className={cn(isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3 mb-4">
          <Filter className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Filters</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Application</label>
            <select
              value={applicationId}
              onChange={(e) => {
                setApplicationId(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Applications</option>
              {applications.map((app) => (
                <option key={app._id} value={app._id}>
                  {app.displayName || app.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
        <CommonTable
          data={items}
          query={query}
          totalRecords={totalItems}
          columns={columns}
          getRowId={(log: any) => log.id}
          onQueryChange={handleQueryChange}
          isLoading={isLoading}
          emptyMessage="No notification logs found matching the selected filters."
        />
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 shadow-sm">
        <div className="flex items-center gap-4">
          <Paginator
            first={(page - 1) * limit}
            rows={limit}
            totalRecords={totalItems}
            rowsPerPageOptions={[10, 20, 50, 100]}
            template="CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first}-{last} of {totalRecords}"
            className="compact-paginator"
            onPageChange={handlePageChange}
          />
        </div>
        <Paginator
          first={(page - 1) * limit}
          rows={limit}
          totalRecords={totalItems}
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
          className="compact-paginator"
          onPageChange={handlePageChange}
        />
      </div>

      {/* Diagnostic Dialog Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
              <h3 className="text-base font-semibold text-[var(--color-text-strong)]">Notification Failure Diagnostics</h3>
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 mb-5 max-h-96 overflow-y-auto">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Error Message</p>
              <p className="text-xs font-mono text-rose-700 dark:text-rose-400 mt-1 whitespace-pre-wrap break-all">
                {selectedError}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedError(null)}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


