import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronRight,
  Download,
  FileWarning,
  Filter,
  RefreshCcw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Dropdown } from 'primereact/dropdown'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import {
  useCollectLogsIntelligenceMutation,
  useGetServersQuery,
  useQueryLogsQuery,
} from '@/services/api/endpoints/serverManagementApi'
import { classNames, formatDate } from '@/utils/serverManagementFormat'
import type { LogSeverity, LogTimeRange, ProcessedLog, ServerConnection, SupportedLogSource } from '@/types/serverManagement'

const severityOptions: LogSeverity[] = ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY']
const sourceOptions: SupportedLogSource[] = ['syslog', 'auth', 'nginx', 'apache', 'application', 'docker', 'kernel', 'journald']
const timeRangeOptions: Array<{ label: string; value: LogTimeRange }> = [
  { label: 'Last 30 minutes', value: '30m' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 4 hours', value: '4h' },
  { label: 'Last 12 hours', value: '12h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 48 hours', value: '48h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom range', value: 'custom' },
]

const severityStyles: Record<LogSeverity, string> = {
  INFO: 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  WARN: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  ERROR: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  CRITICAL: 'bg-red-100 text-red-900 ring-red-300 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
  SECURITY: 'bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
}


const toDateTimeLocalValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const toIsoOrUndefined = (value: string) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const getServerLabel = (server?: ServerConnection) =>
  server ? `${server.name || server.host} (${server.host})` : 'All servers'

const exportCsv = (logs: ProcessedLog[]) => {
  const rows = [
    ['timestamp', 'severity', 'source', 'service', 'message'],
    ...logs.map((log) => [
      log.timestamp,
      log.severity,
      log.source,
      log.serviceName || log.service || '',
      (log.displayMessage || log.message || log.rawMessage || '').replace(/\n/g, ' '),
    ]),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `server-logs-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function LogsPage() {
  const navigate = useNavigate()
  const [selectedServerId, setSelectedServerId] = useState<string>()
  const [selectedSeverity, setSelectedSeverity] = useState<LogSeverity[]>([])
  const [selectedSource, setSelectedSource] = useState<SupportedLogSource[]>([])
  const [timeRange, setTimeRange] = useState<LogTimeRange>('24h')
  const [customStartTime, setCustomStartTime] = useState(() => toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)))
  const [customEndTime, setCustomEndTime] = useState(() => toDateTimeLocalValue(new Date()))
  const [keyword, setKeyword] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [errorSecurityOnly, setErrorSecurityOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [expandedLogId, setExpandedLogId] = useState<string>()

  const { data: servers = [], isLoading: isServersLoading } = useGetServersQuery()
  const { data, isFetching, refetch } = useQueryLogsQuery({
    serverId: selectedServerId,
    timeRange,
    startTime: timeRange === 'custom' ? toIsoOrUndefined(customStartTime) : undefined,
    endTime: timeRange === 'custom' ? toIsoOrUndefined(customEndTime) : undefined,
    severity: selectedSeverity.length ? selectedSeverity : undefined,
    source: selectedSource.length ? selectedSource : undefined,
    keyword,
    serviceName,
    errorSecurityOnly,
    page,
    limit: 50,
    sort: 'desc',
  }, {
    skip: timeRange === 'custom' && (!customStartTime || !customEndTime),
  })
  const [collectLogs, { isLoading: isCollecting }] = useCollectLogsIntelligenceMutation()

  const logs = data?.logs || []
  const summary = data?.summary
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 50)))
  const isLoading = isServersLoading || (isFetching && !data)

  const knownServices = useMemo(
    () => Array.from(new Set([...(summary?.topServices || []).map((item) => item.serviceName), ...logs.map((log) => log.serviceName || log.service || '')].filter(Boolean))),
    [logs, summary?.topServices],
  )

  const handleCollect = async () => {
    if (!selectedServerId) return
    await collectLogs({ serverId: selectedServerId }).unwrap()
    refetch()
  }

  const toggleSeverity = (severity: LogSeverity) => {
    setPage(1)
    setSelectedSeverity((current) =>
      current.includes(severity) ? current.filter((item) => item !== severity) : [...current, severity],
    )
  }

  const toggleSource = (source: SupportedLogSource) => {
    setPage(1)
    setSelectedSource((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source],
    )
  }

  return (
    <>
      {isLoading ? (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <LoadingScreen className="bg-[var(--color-page)]/60 backdrop-blur-sm" message="Loading logs..." />
        </div>
      ) : null}

      <div className="mx-auto max-w-full space-y-6">
        <PageHeader
          eyebrow="Server Agent"
          title="Logs"
          description="Azure-style log search, filtering, incident timeline, security events, and retention-safe cleanup recommendations."
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-hover)]"
              >
                <RefreshCcw className={classNames('h-4 w-4', isFetching ? 'animate-spin' : '')} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => exportCsv(logs)}
                disabled={!logs.length}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-hover)] disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={handleCollect}
                disabled={!selectedServerId || isCollecting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                <RefreshCcw className={classNames('h-4 w-4', isCollecting ? 'animate-spin' : '')} />
                Collect Logs
              </button>
            </div>
          }
        />

        <section className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Scope</span>
            <Dropdown
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              value={selectedServerId ?? ''}
              onChange={(event) => {
                setSelectedServerId(event.value || undefined)
                setPage(1)
              }}
              options={[
                { label: 'All servers', value: '' },
                ...servers.map((server) => ({ label: getServerLabel(server), value: server._id })),
              ]}
              optionLabel="label"
              optionValue="value"
              placeholder="All servers"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
              <span>Time range</span>
              <select
                value={timeRange}
                onChange={(event) => { setTimeRange(event.target.value as LogTimeRange); setPage(1) }}
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold normal-case text-[var(--color-text-strong)] outline-none"
                style={{ marginTop: 6 }}
              >
                {timeRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)] md:col-span-2">
              <span>Search</span>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" style={{ marginTop: 6 }}>
                <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
                <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder="Search message, service, host, IP..." className="min-w-0 flex-1 bg-transparent text-sm normal-case text-[var(--color-text-strong)] outline-none" />
              </div>
            </label>
            <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
              <span>Service</span>
              <input value={serviceName} onChange={(event) => { setServiceName(event.target.value); setPage(1) }} list="log-services" placeholder="Any service" className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold normal-case text-[var(--color-text-strong)] outline-none" style={{ marginTop: 6 }}/>
              <datalist id="log-services">{knownServices.map((service) => <option key={service} value={service} />)}</datalist>
            </label>
          </div>

          {timeRange === 'custom' && (
            <div className="grid gap-3 md:grid-cols-2 xl:col-start-2">
              <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                <span>From</span>
                <input type="datetime-local" value={customStartTime} onChange={(event) => { setCustomStartTime(event.target.value); setPage(1) }} className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm normal-case text-[var(--color-text-strong)] outline-none" />
              </label>
              <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                <span>To</span>
                <input type="datetime-local" value={customEndTime} onChange={(event) => { setCustomEndTime(event.target.value); setPage(1) }} className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm normal-case text-[var(--color-text-strong)] outline-none" />
              </label>
            </div>
          )}

          <div className="space-y-3 xl:col-span-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-text-muted)]">
              <Filter className="h-3.5 w-3.5" />
              Severity
            </div>
            <div className="flex flex-wrap gap-2">
              {severityOptions.map((severity) => (
                <button key={severity} type="button" onClick={() => toggleSeverity(severity)} className={classNames('h-9 rounded-lg px-3 text-xs font-black ring-1 transition', selectedSeverity.includes(severity) ? severityStyles[severity] : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] ring-[var(--color-border)] hover:bg-[var(--color-hover)]')}>
                  {severity}
                </button>
              ))}
              <button type="button" onClick={() => { setErrorSecurityOnly((value) => !value); setPage(1) }} className={classNames('h-9 rounded-lg px-3 text-xs font-black ring-1 transition', errorSecurityOnly ? 'bg-red-100 text-red-800 ring-red-300' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] ring-[var(--color-border)] hover:bg-[var(--color-hover)]')}>
                Error/Security only
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((source) => (
                <button key={source} type="button" onClick={() => toggleSource(source)} className={classNames('h-8 rounded-lg px-3 text-xs font-bold uppercase ring-1 transition', selectedSource.includes(source) ? 'bg-[var(--color-primary)] text-white ring-[var(--color-primary)]' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] ring-[var(--color-border)] hover:bg-[var(--color-hover)]')}>
                  {source}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          {severityOptions.map((severity) => {
            const count = severity === 'INFO' ? summary?.infoCount : severity === 'WARN' ? summary?.warnCount : severity === 'ERROR' ? summary?.errorCount : severity === 'CRITICAL' ? summary?.criticalCount : summary?.securityCount
            return (
              <article key={severity} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between">
                  <span className={classNames('rounded-full px-2.5 py-1 text-[10px] font-black ring-1', severityStyles[severity])}>{severity}</span>
                  {severity === 'SECURITY' ? <ShieldAlert className="h-4 w-4 text-violet-500" /> : <FileWarning className="h-4 w-4 text-[var(--color-text-muted)]" />}
                </div>
                <p className="mt-4 text-3xl font-semibold text-[var(--color-text-strong)]">{count ?? 0}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">events in range</p>
              </article>
            )
          })}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-strong)]">
                <Archive className="h-4 w-4 text-[var(--color-primary)]" />
                Cleanup timeline
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Open scan preview and final execution history for persisted cleanup lifecycle runs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/serverAgent/cleanup-timeline')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-hover)]"
            >
              <Archive className="h-4 w-4" />
              Cleanup Timeline
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
              <h2 className="text-sm font-bold text-[var(--color-text-strong)]">Log records</h2>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">{data?.total ?? 0} total</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {logs.length ? logs.map((log) => {
                    const expanded = expandedLogId === log._id
                    return (
                      <tr key={log._id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-[var(--color-text-muted)]">{formatDate(log.timestamp)}</td>
                        <td className="px-4 py-4"><span className={classNames('rounded-full px-2.5 py-1 text-[10px] font-black ring-1', severityStyles[log.severity])}>{log.severity}</span></td>
                        <td className="px-4 py-4 text-xs font-bold uppercase text-[var(--color-text-muted)]">{log.source}</td>
                        <td className="px-4 py-4 text-sm text-[var(--color-text-muted)]">{log.serviceName || log.service || 'system'}</td>
                        <td className="px-4 py-4">
                          <button type="button" onClick={() => setExpandedLogId(expanded ? undefined : log._id)} className="flex w-full items-start gap-2 text-left">
                            {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />}
                            <span className="font-medium text-[var(--color-text-strong)]">{log.displayMessage || log.message || log.rawMessage}</span>
                          </button>
                          {expanded && (
                            <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs">
                              <div className="grid gap-2 md:grid-cols-3">
                                <p><span className="font-bold">Host:</span> {log.host || 'n/a'}</p>
                                <p><span className="font-bold">PID:</span> {log.processId || log.pid || 'n/a'}</p>
                                <p><span className="font-bold">File:</span> {log.filePath || 'n/a'}</p>
                              </div>
                              <div>
                                <p className="mb-1 font-bold">Raw log</p>
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 text-[var(--color-text-strong)]">{log.rawLine || log.rawMessage}</pre>
                              </div>
                              <div>
                                <p className="mb-1 font-bold">Parsed fields</p>
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 text-[var(--color-text-strong)]">{JSON.stringify(log.parsedFields || {}, null, 2)}</pre>
                              </div>
                              <p><span className="font-bold">Probable root cause:</span> {log.probableRootCause || log.rootCauseSuggestion || 'Correlate this log with nearby metrics and alerts.'}</p>
                              <a href={log.relatedMetricsLink || '/serverAgent/metrics'} className="font-bold text-[var(--color-primary)]">Open related metrics</a>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--color-text-muted)]">No logs match the selected query.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold disabled:opacity-50">Previous</button>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold disabled:opacity-50">Next</button>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--color-text-strong)]"><AlertTriangle className="h-4 w-4 text-amber-500" /> Logs over time</h2>
              <div className="flex h-40 items-end gap-1">
                {(summary?.countOverTime || []).slice(-24).map((point) => {
                  const max = Math.max(1, ...(summary?.countOverTime || []).map((item) => item.count))
                  const date = new Date(point.timestamp)
                  return <div key={point.timestamp} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-[var(--color-primary)]" style={{ height: `${Math.max(4, (point.count / max) * 130)}px` }} title={`${formatDate(point.timestamp)}: ${point.count}`} />
                    <span className="hidden text-[10px] text-[var(--color-text-muted)] md:block text-center leading-tight">
                      {date.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short"
                      })} {date.getHours()}:00, Count: {point.count}
                    </span>
                  </div>
                })}
              </div>
            </section>

            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="mb-3 text-sm font-bold text-[var(--color-text-strong)]">Top affected services</h2>
              <div className="space-y-2">{summary?.topServices?.length ? summary.topServices.map((item) => <div key={item.serviceName} className="flex justify-between rounded bg-[var(--color-surface-muted)] px-3 py-2 text-sm"><span>{item.serviceName}</span><strong>{item.count}</strong></div>) : <p className="text-sm text-[var(--color-text-muted)]">No service data.</p>}</div>
            </section>

            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="mb-3 text-sm font-bold text-[var(--color-text-strong)]">Top errors</h2>
              <div className="space-y-2">{summary?.topErrors?.length ? summary.topErrors.map((item) => <div key={item.pattern} className="rounded bg-[var(--color-surface-muted)] px-3 py-2 text-sm"><div className="flex justify-between gap-3"><span className="line-clamp-2">{item.message}</span><strong>{item.count}</strong></div></div>) : <p className="text-sm text-[var(--color-text-muted)]">No error patterns.</p>}</div>
            </section>

            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="border-b border-[var(--color-border)] p-4">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-strong)]"><Archive className="h-4 w-4 text-[var(--color-primary)]" /> Incident timeline</h2>
              </div>
              <div className="max-h-80 overflow-auto">{summary?.incidentTimeline?.length ? summary.incidentTimeline.map((incident) => <div key={incident._id} className="border-b border-[var(--color-border)] p-4 last:border-0"><span className={classNames('rounded-full px-2 py-0.5 text-[10px] font-black ring-1', severityStyles[incident.severity])}>{incident.severity}</span><h3 className="mt-2 text-sm font-semibold text-[var(--color-text-strong)]">{incident.title}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{incident.occurrenceCount} occurrences, last seen {formatDate(incident.lastSeenAt)}</p></div>) : <p className="p-4 text-sm text-[var(--color-text-muted)]">No incident patterns.</p>}</div>
            </section>
          </div>
        </div>
      </div>

    </>
  )
}
