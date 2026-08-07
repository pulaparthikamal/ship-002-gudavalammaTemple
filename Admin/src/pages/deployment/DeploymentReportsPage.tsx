import { useMemo, useState } from 'react'
import {
  CheckCircle,
  Clock,
  Download,
  Filter,
  History,
  RefreshCw,
  Rocket,
  Search,
  Server,
  ShieldCheck,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Dropdown } from 'primereact/dropdown'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import {
  useGetApplicationsQuery,
  useGetDeploymentTargetsQuery,
  useGetReportDashboardStatsQuery,
  useGetDeploymentsReportQuery,
  useGetVersionsReportQuery,
  useGetServersReportQuery,
  useGetFailuresReportQuery,
  useGetAuditTrailReportQuery,
} from '@/services/api/endpoints/deploymentAgentApi'
import { apiClient } from '@/services/api/axiosInstance'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/classNames'

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899']

export function DeploymentReportsPage() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'audit'>('overview')

  // Global filters (shared/used across tabs where appropriate)
  const [applicationId, setApplicationId] = useState<string>('')
  const [targetId, setTargetId] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  // Secondary sub-filters
  const [auditSearch, setAuditSearch] = useState<string>('')

  // Dropdown query dependencies
  const { data: applications = [] } = useGetApplicationsQuery()
  const { data: targets = [] } = useGetDeploymentTargetsQuery()

  const reportParams = useMemo(() => ({
    applicationId: applicationId || undefined,
    targetId: targetId || undefined,
    status: status || undefined,
  }), [applicationId, targetId, status])

  // Queries for different tabs/sections
  const { data: dashStats, isLoading: dashStatsLoading, refetch: refetchDash } = useGetReportDashboardStatsQuery(reportParams)
  const { data: deploymentsData, isLoading: deploymentsLoading, refetch: refetchDeployments } = useGetDeploymentsReportQuery(reportParams)
  const { data: versionsData, isLoading: versionsLoading } = useGetVersionsReportQuery({ applicationId: applicationId || undefined })
  const { data: serversData, isLoading: serversLoading, refetch: refetchServers } = useGetServersReportQuery()
  const { data: failuresData, isLoading: failuresLoading } = useGetFailuresReportQuery(reportParams)
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudits } = useGetAuditTrailReportQuery({
    ...reportParams,
    limit: '100',
  })

  const hasActiveFilters = Boolean(
    applicationId ||
    targetId ||
    status
  )

  const applicationOptions = [
    { label: 'All Applications', value: '' },
    ...applications.map((app) => ({
      label: app.name,
      value: app._id,
    })),
  ]

  const targetOptions = [
    { label: 'All Targets', value: '' },
    ...targets.map((tgt) => ({
      label: tgt.name,
      value: tgt._id,
    })),
  ]

  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Success', value: 'success' },
    { label: 'Failed', value: 'failed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Running', value: 'running' },
  ]

  const handleDownload = async (type: string, format: string) => {
    try {
      showToast({ severity: 'info', summary: 'Exporting...', detail: 'Preparing your file download' })
      const response = await apiClient.get('/deploymentAgent/deployments/reports/export', {
        params: {
          type,
          format,
          ...reportParams,
        },
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      let ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv'
      link.setAttribute('download', `deployment_${type}_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      showToast({ severity: 'success', summary: 'Export Completed', detail: 'File downloaded successfully.' })
    } catch (err: any) {
      console.error(err)
      showToast({ severity: 'error', summary: 'Export Failed', detail: 'Could not export reports.' })
    }
  }

  const handleRefreshAll = () => {
    refetchDash()
    refetchDeployments()
    refetchServers()
    refetchAudits()
    showToast({ severity: 'success', summary: 'Data Refreshed', detail: 'Metrics updated successfully.' })
  }

  // Filtered audit logs
  const filteredAudits = useMemo(() => {
    if (!auditData?.items) return []
    const term = auditSearch.toLowerCase().trim()
    if (!term) return auditData.items
    return auditData.items.filter((log: any) =>
      (log.details || '').toLowerCase().includes(term) ||
      (log.action || '').toLowerCase().includes(term) ||
      (log.userName || 'System').toLowerCase().includes(term)
    )
  }, [auditData, auditSearch])

  // Chart Mappings
  const chartTrends = useMemo(() => {
    if (!dashStats?.monthlyTrends) return []
    return dashStats.monthlyTrends.map((t: any) => ({
      name: t._id || 'Unknown',
      Success: t.success,
      Failure: t.failed,
    }))
  }, [dashStats])

  const chartFailures = useMemo(() => {
    if (!failuresData?.categoryTrend) return []
    return failuresData.categoryTrend.map((f: any) => ({
      name: f.category || 'Unknown',
      value: f.count,
    }))
  }, [failuresData])

  const handleClearFilters = () => {
    setApplicationId('')
    setTargetId('')
    setStatus('')

    showToast({
      severity: 'success',
      summary: 'Filters Cleared',
      detail: 'All filters have been reset.',
    })
  }

  const isLoading =
    dashStatsLoading ||
    deploymentsLoading ||
    versionsLoading ||
    serversLoading ||
    failuresLoading ||
    auditLoading

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Deployment Agent"
          title="Reports & Analytics"
          description="Examine deployment statistics, server component checks, audit trails, and version revisions."
        />
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Global filters container */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
              Filters
            </h3>
          </div>

          <button
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              hasActiveFilters
                ? 'border border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20'
                : 'cursor-not-allowed border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] opacity-50'
            )}
          >
            Clear Filters
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Application</label>
            <Dropdown
              value={applicationId}
              options={applicationOptions}
              onChange={(e) => setApplicationId(e.value)}
              placeholder="All Applications"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Target Server</label>
            <Dropdown
              value={targetId}
              options={targetOptions}
              onChange={(e) => setTargetId(e.value)}
              placeholder="All Targets"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Status</label>
            <Dropdown
              value={status}
              options={statusOptions}
              onChange={(e) => setStatus(e.value)}
              placeholder="All Statuses"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {(['overview', 'deployments', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-6 py-3 text-sm font-semibold border-b-2 transition-all capitalize',
              activeTab === tab
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-soft)] rounded-t-lg'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Success Rate</p>
                <p className="text-2xl font-bold text-[var(--color-text-strong)]">
                  {dashStats?.totalDeployments && typeof dashStats.successfulDeployments === 'number'
                    ? `${Math.round((dashStats.successfulDeployments / dashStats.totalDeployments) * 100)}%`
                    : '0%'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-500/10">
                <Rocket className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Total Deployments</p>
                <p className="text-2xl font-bold text-[var(--color-text-strong)]">
                  {dashStats?.totalDeployments || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Avg Duration</p>
                <p className="text-2xl font-bold text-[var(--color-text-strong)]">
                  {dashStats?.avgDuration ? `${Math.round(dashStats.avgDuration / 1000)}s` : '0s'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-500/10">
                <Server className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Targets Active</p>
                <p className="text-2xl font-bold text-[var(--color-text-strong)]">
                  {serversData?.filter((s: any) => s.status === 'connected').length || 0} / {serversData?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Success Trend */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--color-text-strong)] mb-4">Deployment Volumes (Monthly)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFailure" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Area type="monotone" dataKey="Success" stroke="#10B981" fillOpacity={1} fill="url(#colorSuccess)" />
                    <Area type="monotone" dataKey="Failure" stroke="#EF4444" fillOpacity={1} fill="url(#colorFailure)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Failure Breakdown */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--color-text-strong)] mb-4">Pipeline Failure Diagnostics</h3>
              <div className="h-72 flex flex-col sm:flex-row items-center justify-between gap-4">
                {chartFailures.length > 0 ? (
                  <>
                    <div className="w-full sm:w-1/2 h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartFailures}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {chartFailures.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 w-full max-h-60 overflow-y-auto">
                      {chartFailures.map((item: any, idx: number) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-[var(--color-text-muted)] font-medium max-w-40 truncate">{item.name}</span>
                          </div>
                          <span className="font-semibold text-[var(--color-text-strong)]">{item.value} times</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
                    <CheckCircle className="h-12 w-12 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-[var(--color-text-strong)]">No deployment failures reported!</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Pipeline runs are running optimally.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'deployments' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base font-semibold text-[var(--color-text-strong)]">Deployment Records & Revisions</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleDownload('deployments', 'csv')}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              >
                <Download size={14} />
                CSV
              </button>
              <button
                onClick={() => handleDownload('deployments', 'excel')}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              >
                <Download size={14} />
                Excel
              </button>
              <button
                onClick={() => handleDownload('deployments', 'pdf')}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              >
                <Download size={14} />
                PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Deployments History Table */}
            <div className="xl:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--color-border)]">
                  <thead className="bg-[var(--color-surface-muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Application / Target</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Environment</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Execution Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-sm">
                    {deploymentsData?.items?.length > 0 ? (
                      deploymentsData.items.map((d: any) => (
                        <tr key={d.id} className="hover:bg-[var(--color-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--color-text-strong)]">{d.appName || 'Unknown App'}</div>
                            <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                              <Server className="h-3 w-3" />
                              {d.serverName || 'Unknown Target'}
                            </div>
                          </td>
                          <td className="px-4 py-3 capitalize text-[var(--color-text-muted)]">{d.environment || 'production'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                                d.status === 'success'
                                  ? 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : d.status === 'failed' || d.status === 'rolled_back'
                                    ? 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300'
                              )}
                            >
                              {d.status === 'rolled_back' ? 'failed (rolled back)' : d.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">
                            {d.durationMs
                              ? `${Math.round(d.durationMs / 1000)}s`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                            {new Date(d.startedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-[var(--color-text-muted)]">
                          No matching deployment history records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Version Revision History */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
                <History className="h-4 w-4 text-[var(--color-text-muted)]" />
                <h4 className="font-semibold text-sm text-[var(--color-text-strong)]">Revisions & Releases</h4>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {versionsData?.items?.length > 0 ? (
                  versionsData.items.map((ver: any, index: number) => (
                    <div key={ver.id || index} className="relative pl-6 pb-4 border-l border-[var(--color-border)] last:pb-0">
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[var(--color-primary)] border border-white dark:border-neutral-900" />
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-[var(--color-text-strong)]">Version Revision</span>
                        <span className="text-[var(--color-text-muted)]">{new Date(ver.deployedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-text-muted)] truncate">Commit: {ver.commitHash || 'Manual'}</p>
                      {ver.commitMsg && ver.commitMsg !== '—' && (
                        <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] p-1.5 rounded border border-[var(--color-border)] mt-1 truncate">
                          {ver.commitMsg}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">
                    Select an application filter to review release revision timelines.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Audit Controls & Export */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-4 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload('audit-trail', 'csv')}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={() => handleDownload('audit-trail', 'pdf')}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              >
                <Download size={14} /> Export PDF
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-border)]">
                <thead className="bg-[var(--color-surface-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Target Environment</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-sm">
                  {filteredAudits.length > 0 ? (
                    filteredAudits.map((log: any) => (
                      <tr key={log._id} className="hover:bg-[var(--color-hover)] transition-colors">
                        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--color-text-strong)]">
                          {log.userId?.name || 'System'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[var(--color-text-strong)] font-medium text-xs">{log.targetName || 'Global'}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{log.environment}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              log.result === 'success'
                                ? 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : log.result === 'failed'
                                  ? 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300'
                                  : 'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300'
                            )}
                          >
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[var(--color-text-muted)]">
                        No audit records found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
