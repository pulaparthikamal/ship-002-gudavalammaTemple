import { Activity, Cpu, GitBranch, HardDrive, MemoryStick, Network, Server } from 'lucide-react'
import { MetricCard } from './MetricCard'
import type { MonitoringHealthScore, MonitoringMetricHistory } from '@/types/serverManagement'
import { CHART_COLORS } from '@/utils/themeColors'

function formatRate(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB/s`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB/s`
  return `${Math.round(value)} B/s`
}

function formatBytesToGB(bytes?: number) {
  if (!bytes) return '0 GB'
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function HealthOverviewCard({
  metric,
  metrics = [],
  isLive = false,
}: {
  metric?: MonitoringMetricHistory
  metrics?: MonitoringMetricHistory[]
  healthScore?: MonitoringHealthScore
  isLive?: boolean
}) {
  const serviceSummary = metric?.serviceSummary
  const running = serviceSummary?.running ?? 0
  const failed = serviceSummary?.failed ?? 0
  const inactive = serviceSummary?.inactive ?? 0
  const totalServices = running + failed + inactive
  const processCount = metric?.processSummary?.total ?? 0
  const networkRate = (metric?.networkRxBytesPerSecond ?? 0) + (metric?.networkTxBytesPerSecond ?? 0)

  const rootFs = metric?.filesystems?.find((fs) => fs.mount === '/') || metric?.filesystems?.[0]

  console.log(metric);

  const osName = metric?.os?.name || 'Linux'
  const osVersion = metric?.os?.version || ''
  const osKernel = metric?.os?.kernel || ''
  const osHostname = metric?.os?.hostname || ''
  
  return (
    <div className="space-y-4">
      {metric?.os && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] shadow-sm">
          <span className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Server OS: <strong className="text-[var(--color-text-strong)]">{osName} {osVersion}</strong></span>
          </span>
          {osKernel && <span className="opacity-45">|</span>}
          {osKernel && <span>Kernel: <strong className="text-[var(--color-text-strong)]">{osKernel}</strong></span>}
          {osHostname && <span className="opacity-45">|</span>}
          {osHostname && <span>Hostname: <strong className="text-[var(--color-text-strong)]">{osHostname}</strong></span>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
      <MetricCard
        label="CPU usage"
        value={`${Math.round(metric?.cpuUsagePercent ?? 0)}%`}
        detail={metric?.cpuCoreCount ? `• ${metric.cpuCoreCount} Cores` : '• avg 24h'}
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => m.cpuUsagePercent ?? 0}
        icon={Cpu}
        colorClass={CHART_COLORS.cpu.gradient}
        strokeColor={CHART_COLORS.cpu.stroke}
        iconTone="bg-blue-50 text-blue-600"
        badge={`${Math.round(metric?.cpuUsagePercent ?? 0)}%`}
        live={isLive}
      />
      <MetricCard
        label="Memory usage"
        value={`${Math.round(metric?.memoryUsagePercent ?? 0)}%`}
        detail={
          metric?.memoryUsedBytes && metric?.memoryFreeBytes
            ? (
              <span>
                {`• ${formatBytesToGB(metric.memoryUsedBytes + metric.memoryFreeBytes)} RAM`}
                {metric.memoryCachedBytes !== undefined && metric.memoryCachedBytes > 0 && (
                  <>
                    <span className="opacity-40 mx-1">•</span>
                    <span>{`${formatBytesToGB(metric.memoryCachedBytes)} Cached`}</span>
                  </>
                )}
              </span>
            )
            : '• avg 24h'
        }
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => m.memoryUsagePercent ?? 0}
        icon={MemoryStick}
        colorClass={CHART_COLORS.memory.gradient}
        strokeColor={CHART_COLORS.memory.stroke}
        iconTone="bg-emerald-50 text-emerald-700"
        badge={`${Math.round(metric?.memoryUsagePercent ?? 0)}%`}
        live={isLive}
      />
      <MetricCard
        label="Disk usage"
        value={`${Math.round(metric?.diskUsagePercent ?? 0)}%`}
        detail={
          rootFs
            ? `• ${formatBytesToGB(rootFs.totalBytes)}`
            : '• overall'
        }
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => m.diskUsagePercent ?? 0}
        icon={HardDrive}
        colorClass={CHART_COLORS.disk.gradient}
        strokeColor={CHART_COLORS.disk.stroke}
        iconTone="bg-amber-50 text-amber-700"
        badge={`${Math.round(metric?.diskUsagePercent ?? 0)}%`}
      />
      <MetricCard
        label="Network throughput"
        value={formatRate(networkRate).replace(' ', '')}
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => {
          const max = 10 * 1024 * 1024
          const val = (m.networkRxBytesPerSecond ?? 0) + (m.networkTxBytesPerSecond ?? 0)
          return Math.min((val / max) * 100, 100)
        }}
        icon={Network}
        colorClass="from-violet-400 to-violet-600"
        strokeColor="#8b5cf6"
        iconTone="bg-violet-50 text-violet-700"
        badge={networkRate > 0 ? 'Normal' : 'Idle'}
        live={isLive}
      />
      <MetricCard
        label="Load average"
        value={(metric?.loadAverage ?? 0).toFixed(2)}
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => (m.loadAverage ?? 0) * 10}
        icon={Activity}
        colorClass="from-emerald-400 to-green-600"
        strokeColor="#10b981"
        iconTone="bg-teal-50 text-teal-700"
        badge="Healthy"
        live={isLive}
      />
      <MetricCard
        label="Running processes"
        value={`${processCount}`}
        detail="proc"
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => Math.min((m.processSummary?.total ?? 0) / 5, 100)}
        icon={GitBranch}
        colorClass="from-orange-400 to-orange-600"
        strokeColor="#f97316"
        iconTone="bg-orange-50 text-orange-700"
        badge="Running"
        live={isLive}
      />
      <MetricCard
        label="Services"
        value={totalServices.toString()}
        detail={
          <span className="flex items-center gap-1.5 opacity-90">
            <span className="text-emerald-600" title="Running">{running}R</span>
            <span className="text-rose-600" title="Failed">{failed}F</span>
            <span className="text-slate-500" title="Inactive">{inactive}I</span>
          </span>
        }
        data={metrics}
        getValue={(m: MonitoringMetricHistory) => {
          return m.serviceSummary?.running ?? 0
        }}
        icon={Server}
        colorClass="from-blue-400 to-blue-600"
        strokeColor="#3b82f6"
        iconTone="bg-sky-50 text-sky-700"
        badge={failed ? `${failed} failed` : 'Healthy'}
      />
      </div>
    </div>
  )
}
