import { useState } from 'react'
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react'
import { Dropdown } from 'primereact/dropdown'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  useGetFileScanResultsQuery,
  useGetFileScannerAlertsQuery,
  useGetFileScannerStatusQuery,
  useGetQuarantinedFilesQuery,
  useGetServersQuery,
  useMarkFileScanSafeMutation,
  usePermanentDeleteQuarantinedFileMutation,
  useRestoreQuarantinedFileMutation,
} from '@/services/api/endpoints/serverManagementApi'
import type { FileRiskLevel, FileScanResult } from '@/types/serverManagement'
import { classNames, formatDate } from '@/utils/serverManagementFormat'

const riskLevels: Array<FileRiskLevel | ''> = ['', 'safe', 'low', 'medium', 'high', 'critical']
const riskTone: Record<FileRiskLevel, string> = {
  safe: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  low: 'bg-sky-50 text-sky-700 ring-sky-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  critical: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function FileScannerPage() {
  const [selectedServerId, setSelectedServerId] = useState('')
  const [riskLevel, setRiskLevel] = useState<FileRiskLevel | ''>('')
  const [selectedResult, setSelectedResult] = useState<FileScanResult | null>(null)
  const { data: servers = [] } = useGetServersQuery()
  const { data: scannerStatus } = useGetFileScannerStatusQuery(selectedServerId || undefined)
  const { data: results = [], refetch, isFetching } = useGetFileScanResultsQuery({
    serverId: selectedServerId || undefined,
    riskLevel: riskLevel || undefined,
    timeRange: '7d',
    limit: 100,
  })
  const { data: quarantine = [] } = useGetQuarantinedFilesQuery({ serverId: selectedServerId || undefined, limit: 50 })
  const { data: scannerAlerts = [] } = useGetFileScannerAlertsQuery({ serverId: selectedServerId || undefined, timeRange: '7d', limit: 25 })
  const [restoreFile] = useRestoreQuarantinedFileMutation()
  const [markSafe] = useMarkFileScanSafeMutation()
  const [deleteFile] = usePermanentDeleteQuarantinedFileMutation()

  const highRiskCount = results.filter((item) => item.riskLevel === 'high' || item.riskLevel === 'critical').length

  const confirmPermanentDelete = async (id: string) => {
    if (!window.confirm('Permanent delete is irreversible. It is only allowed after backup verification. Continue?')) return
    await deleteFile(id).unwrap()
    setSelectedResult(null)
    refetch()
  }

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Server Agent"
        title="File Integrity & Threat Scanner"
        description="Detect server-wide file changes, classify content, backup before action, and audit harmful findings."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Detected files</p>
          <p className="mt-2 text-3xl font-black text-[var(--color-text-strong)]">{results.length}</p>
        </article>
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">High/Critical</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{highRiskCount}</p>
        </article>
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Quarantined</p>
          <p className="mt-2 text-3xl font-black text-[var(--color-text-strong)]">{quarantine.length}</p>
        </article>
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Scanner</p>
          <p className="mt-2 text-sm font-bold text-[var(--color-text-strong)]">{isFetching ? 'Refreshing' : scannerStatus?.enabled ? 'Enabled' : 'Disabled'}</p>
        </article>
      </section>

      {highRiskCount > 0 && (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {highRiskCount} harmful or suspicious file{highRiskCount === 1 ? '' : 's'} detected. Review compressed backup and quarantine status before restoring or deleting anything.
        </section>
      )}

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Watcher mode</p>
            <p className="mt-1 text-lg font-black text-[var(--color-text-strong)]">{scannerStatus?.mode || 'server_wide'}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Server-wide monitoring excludes system/noisy paths for safety and performance.</p>
          </div>
          <div className="max-w-3xl text-xs text-[var(--color-text-muted)]">
            <p><b>Roots:</b> {(scannerStatus?.watchedRoots || []).join(', ')}</p>
            <p className="mt-1"><b>Excluded:</b> {(scannerStatus?.excludedPaths || []).join(', ')}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <Dropdown
          value={selectedServerId}
          onChange={(event) => setSelectedServerId(event.value)}
          options={[{ label: 'All servers', value: '' }, ...servers.map((server) => ({ label: `${server.name || server.host} (${server.host})`, value: server._id }))]}
          optionLabel="label"
          optionValue="value"
          className="h-10 min-w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
        />
        <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as FileRiskLevel | '')} className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold">
          {riskLevels.map((risk) => <option key={risk || 'all'} value={risk}>{risk ? risk.toUpperCase() : 'All risk levels'}</option>)}
        </select>
        <button type="button" onClick={() => refetch()} className="h-10 rounded-lg border border-[var(--color-border)] px-4 text-sm font-bold">Refresh</button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-border)] p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-strong)]"><ShieldAlert className="h-4 w-4 text-rose-500" /> Latest detected files</h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-xs uppercase text-[var(--color-text-muted)]">
                <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Detected</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {results.map((item) => (
                  <tr key={item._id} className="cursor-pointer hover:bg-[var(--color-hover)]" onClick={() => setSelectedResult(item)}>
                    <td className="px-4 py-4">
                      <div className="max-w-md overflow-hidden">
                        <p className="truncate font-bold text-[var(--color-text-strong)]" title={item.fileName}>{item.fileName}</p>
                        <p className="truncate text-xs text-[var(--color-text-muted)]" title={item.filePath}>{item.filePath}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-bold uppercase text-[var(--color-text-muted)]">{item.fileCategory || 'unknown'}</td>
                    <td className="px-4 py-4"><span className={classNames('rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1', riskTone[item.riskLevel])}>{item.riskLevel}</span></td>
                    <td className="px-4 py-4 font-black">{item.riskScore}</td>
                    <td className="px-4 py-4 text-xs font-bold uppercase text-[var(--color-text-muted)]">{item.actionStatus || item.scanStatus}</td>
                    <td className="px-4 py-4 text-xs text-[var(--color-text-muted)]">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
                {!results.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--color-text-muted)]">No file scan results yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {selectedResult ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-strong)]">{selectedResult.fileName}</h2>
                  <p className="break-all text-xs text-[var(--color-text-muted)]">{selectedResult.filePath}</p>
                </div>
                <span className={classNames('rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1', riskTone[selectedResult.riskLevel])}>{selectedResult.riskLevel}</span>
              </div>
              <div className="grid gap-2 text-sm">
                <p><b>Category:</b> {selectedResult.fileCategory} ({Math.round((selectedResult.typeConfidence || 0) * 100)}%)</p>
                <p><b>Type:</b> {selectedResult.detectedFileType || selectedResult.mimeType || 'unknown'}</p>
                <p><b>Size:</b> {selectedResult.fileSize} bytes</p>
                <p><b>Hash:</b> <span className="break-all text-xs">{selectedResult.fileHash || 'n/a'}</span></p>
                <p><b>Compressed backup:</b> {selectedResult.backupStatus} {selectedResult.compressedBackupPath || selectedResult.backupPath ? `(${selectedResult.compressedBackupPath || selectedResult.backupPath})` : ''}</p>
                <p><b>Quarantine/delete:</b> {selectedResult.quarantineStatus} {selectedResult.quarantinePath ? `(${selectedResult.quarantinePath})` : ''}</p>
              </div>
              {!!selectedResult.harmfulBehaviors?.length && (
                <div>
                  <h3 className="text-sm font-bold">Harmful behaviors</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedResult.harmfulBehaviors.map((behavior) => <span key={behavior} className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">{behavior}</span>)}
                  </div>
                </div>
              )}
              {!!selectedResult.typeSignals?.length && (
                <div>
                  <h3 className="text-sm font-bold">Type signals</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{selectedResult.typeSignals.join(', ')}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold">Risk reasons</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
                  {selectedResult.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
              <div className="rounded-lg bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-muted)]">
                {selectedResult.aiExplanation}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => restoreFile(selectedResult._id).unwrap().then(() => refetch())} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-bold"><RotateCcw className="h-4 w-4" /> Restore</button>
                <button type="button" onClick={() => markSafe(selectedResult._id).unwrap().then(() => refetch())} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-bold"><CheckCircle2 className="h-4 w-4" /> Mark safe</button>
                <button type="button" onClick={() => confirmPermanentDelete(selectedResult._id)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700"><Trash2 className="h-4 w-4" /> Permanent delete</button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center text-center text-sm text-[var(--color-text-muted)]">
              <div><AlertTriangle className="mx-auto h-8 w-8" /><p className="mt-2">Select a scan result to view details.</p></div>
            </div>
          )}
        </aside>
      </div>

      {!!scannerAlerts.length && (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-sm font-bold text-[var(--color-text-strong)]">Scanner alerts</h2>
          <div className="mt-3 space-y-2">
            {scannerAlerts.slice(0, 5).map((alert) => (
              <div key={alert._id} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-800">
                <p className="font-bold">{alert.message}</p>
                <p className="text-xs">{formatDate(alert.createdAt)} · action: {alert.actionTaken}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
