import type { MonitoringProcess } from '@/types/serverManagement'

function percentBar(value: number, tone: string) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-sm font-black text-[var(--color-text-strong)]">{value.toFixed(1)}%</span>
      <div className="h-1.5 w-20 rounded-full bg-[var(--color-border)]">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
      </div>
    </div>
  )
}

export function TopProcessesTable({ processes = [] }: { processes?: MonitoringProcess[] }) {
  const rows = processes.slice(0, 8)

  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-strong)]">
      <h3 className="text-lg font-black text-[var(--color-text-strong)]">Top processes by CPU & memory</h3>
      <div className="mt-4 overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-[var(--color-text-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-3 pr-4">Process</th>
              <th className="px-4 py-3">PID</th>
              <th className="px-4 py-3">CPU%</th>
              <th className="px-4 py-3">MEM%</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.length ? (
              rows.map((process) => (
                <tr key={`${process.pid}-${process.name}`}>
                  <td className="py-3 pr-4 text-base font-black text-[var(--color-text-strong)]">{process.name}</td>
                  <td className="px-4 py-3 font-bold text-[var(--color-text-muted)]">{process.pid}</td>
                  <td className="px-4 py-3">{percentBar(process.cpuPercent || 0, 'bg-red-400')}</td>
                  <td className="px-4 py-3">{percentBar(process.memoryPercent || 0, 'bg-blue-400')}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
                      {process.state?.includes('Z') ? 'zombie' : process.state?.includes('D') ? 'blocked' : 'running'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">
                  No process diagnostics collected yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
