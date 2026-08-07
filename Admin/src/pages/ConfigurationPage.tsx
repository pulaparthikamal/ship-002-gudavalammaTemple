import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Save, SlidersHorizontal } from 'lucide-react'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Checkbox } from 'primereact/checkbox'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useToast } from '@/hooks/useToast'
import {
  useGetConfigQuery,
  useGetServersQuery,
  useSaveConfigMutation,
} from '@/services/api/endpoints/serverManagementApi'
import type { MaintenanceConfig } from '@/types/serverManagement'

type ConfigForm = Pick<
  MaintenanceConfig,
  | 'diskThresholdPercent'
  | 'cpuThresholdPercent'
  | 'memoryThresholdPercent'
  | 'scanFrequencyMinutes'
  | 'predictionIntervalMinutes'
  | 'unusedFileDays'
  | 'largeFileMb'
  | 'archiveOlderThanDays'
  | 'deleteOlderThanDays'
  | 'cleanupAutomationEnabled'
  | 'cleanupFrequencyMinutes'
  | 'archiveLargeFileMb'
  | 'archiveDirectory'
  | 'automationEnabled'
  | 'maxRestartAttempts'
  | 'restartCooldownMinutes'
  | 'slackWebhookUrl'
  | 'telegramBotToken'
  | 'telegramChatId'
>

const defaultForm: ConfigForm = {
  diskThresholdPercent: 60,
  cpuThresholdPercent: 85,
  memoryThresholdPercent: 85,
  scanFrequencyMinutes: 5,
  predictionIntervalMinutes: 180,
  unusedFileDays: 30,
  largeFileMb: 100,
  archiveOlderThanDays: 30,
  deleteOlderThanDays: 90,
  cleanupAutomationEnabled: false,
  cleanupFrequencyMinutes: 1440,
  archiveLargeFileMb: 250,
  archiveDirectory: '/tmp/ai-server-archives',
  automationEnabled: false,
  maxRestartAttempts: 3,
  restartCooldownMinutes: 5,
  slackWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
}

const minutesToTime = (minutes: number) => {
  const date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

const timeToMinutes = (value: Date | null) => {
  if (!value) {
    return 180
  }

  const totalMinutes = value.getHours() * 60 + value.getMinutes()
  return totalMinutes > 0 ? totalMinutes : 180
}

export function ConfigurationPage() {
  const { showToast } = useToast()
  const [selectedServerId, setSelectedServerId] = useState<string>()
  const [form, setForm] = useState(defaultForm)
  const [predictionScheduleTime, setPredictionScheduleTime] = useState<Date | null>(minutesToTime(180))
  const [scanDirectories, setScanDirectories] = useState('/tmp, /var/log')
  const [ignoreFolders, setIgnoreFolders] = useState('/proc, /sys, /dev, /run')
  const [tempPatterns, setTempPatterns] = useState('*.tmp, *.temp, *.cache')
  const [logPatterns, setLogPatterns] = useState('*.log, *.out')
  const { data: servers = [], isLoading: isServersLoading } = useGetServersQuery()
  const { data: config, isFetching: isConfigFetching } = useGetConfigQuery(selectedServerId ?? '', { skip: !selectedServerId })
  const [saveConfig, { isLoading: isSaving }] = useSaveConfigMutation()

  const isPageLoading = isServersLoading || isConfigFetching || isSaving

  useEffect(() => {
    if (!selectedServerId && servers[0]?._id) {
      setSelectedServerId(servers[0]._id)
    }
  }, [selectedServerId, servers])

  useEffect(() => {
    if (!config) {
      return
    }

    setForm({
      diskThresholdPercent: config.diskThresholdPercent,
      cpuThresholdPercent: config.cpuThresholdPercent,
      memoryThresholdPercent: config.memoryThresholdPercent,
      scanFrequencyMinutes: config.scanFrequencyMinutes,
      predictionIntervalMinutes: config.predictionIntervalMinutes ?? 180,
      unusedFileDays: config.unusedFileDays,
      largeFileMb: config.largeFileMb,
      archiveOlderThanDays: config.archiveOlderThanDays ?? defaultForm.archiveOlderThanDays,
      deleteOlderThanDays: config.deleteOlderThanDays ?? defaultForm.deleteOlderThanDays,
      cleanupAutomationEnabled: config.cleanupAutomationEnabled ?? defaultForm.cleanupAutomationEnabled,
      cleanupFrequencyMinutes: config.cleanupFrequencyMinutes ?? defaultForm.cleanupFrequencyMinutes,
      archiveLargeFileMb: config.archiveLargeFileMb,
      archiveDirectory: config.archiveDirectory,
      automationEnabled: config.automationEnabled,
      maxRestartAttempts: config.maxRestartAttempts ?? 3,
      restartCooldownMinutes: config.restartCooldownMinutes ?? 5,
      slackWebhookUrl: config.slackWebhookUrl ?? '',
      telegramBotToken: config.telegramBotToken ?? '',
      telegramChatId: config.telegramChatId ?? '',
    })
    setPredictionScheduleTime(minutesToTime(config.predictionIntervalMinutes ?? 180))
    setScanDirectories(config.scanDirectories.join(', '))
    setIgnoreFolders(config.ignoreFolders.join(', '))
    setTempPatterns(config.tempPatterns.join(', '))
    setLogPatterns(config.logPatterns.join(', '))
  }, [config])

  const updateNumber = (key: keyof ConfigForm, value: number | null | undefined) => {
    setForm((current) => ({ ...current, [key]: value ?? 0 }))
  }

  const splitList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedServerId) {
      return
    }

    await saveConfig({
      serverId: selectedServerId,
      ...form,
      predictionIntervalMinutes: timeToMinutes(predictionScheduleTime),
      scanDirectories: splitList(scanDirectories),
      ignoreFolders: splitList(ignoreFolders),
      tempPatterns: splitList(tempPatterns),
      logPatterns: splitList(logPatterns),
      rules: [
        {
          enabled: true,
          action: 'delete',
          category: 'unused',
          olderThanDays: form.deleteOlderThanDays,
        },
        {
          enabled: true,
          action: 'archive',
          category: 'large',
          largerThanMb: form.archiveLargeFileMb,
        },
        {
          enabled: true,
          action: 'delete',
          category: 'temp',
          olderThanDays: form.unusedFileDays,
        },
      ],
    }).unwrap()
    showToast({ severity: 'success', summary: 'Configuration saved' })
  }

  const serverOptions = servers.map((server) => ({
    label: `${server.name} (${server.host})`,
    value: server._id,
  }))

  return (
    <>
      {isPageLoading && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <LoadingScreen className="bg-[var(--color-page)]/60 backdrop-blur-sm" message="Loading configuration data..." />
        </div>
      )}
      <div className="mx-auto max-w-full space-y-5">
        <PageHeader
        eyebrow="Configuration"
        title="Maintenance rules"
        description="Thresholds, scan cadence, ignored folders, and automation boundaries."
      />

      <form
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 md:flex-row md:items-end md:justify-between">
          <label className="w-full max-w-md space-y-1">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Server</span>
            <Dropdown
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
              value={selectedServerId}
              options={serverOptions}
              onChange={(e) => setSelectedServerId(e.value)}
              placeholder="Select a Server"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            disabled={!selectedServerId || isSaving}
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['diskThresholdPercent', 'Disk %'],
            ['cpuThresholdPercent', 'CPU %'],
            ['memoryThresholdPercent', 'Memory %'],
            ['scanFrequencyMinutes', 'Scan minutes'],
            ['unusedFileDays', 'Unused days'],
            ['largeFileMb', 'Large MB'],
            ['archiveLargeFileMb', 'Archive MB'],
          ].map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-sm font-semibold text-[var(--color-text-strong)]">{label}</span>
              <InputNumber
                className="w-full"
                inputClassName="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                value={form[key as keyof ConfigForm] as number}
                onValueChange={(e) => updateNumber(key as keyof ConfigForm, e.value)}
                min={1}
              />
            </label>
          ))}
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Prediction schedule</span>
            <Calendar
              value={predictionScheduleTime}
              onChange={(event) => setPredictionScheduleTime((event.value as Date | null) ?? minutesToTime(180))}
              timeOnly
              hourFormat="24"
              showIcon
              inputClassName="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              className="w-full"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Prediction runs every {Math.floor(timeToMinutes(predictionScheduleTime) / 60)}h {timeToMinutes(predictionScheduleTime) % 60}m.
            </p>
          </label>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Scan directories</span>
            <InputText
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              value={scanDirectories}
              onChange={(event) => setScanDirectories(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Ignore folders</span>
            <InputText
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              value={ignoreFolders}
              onChange={(event) => setIgnoreFolders(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Temp patterns</span>
            <InputText
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              value={tempPatterns}
              onChange={(event) => setTempPatterns(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Log patterns</span>
            <InputText
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              value={logPatterns}
              onChange={(event) => setLogPatterns(event.target.value)}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">Archive directory</span>
            <InputText
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              value={form.archiveDirectory}
              onChange={(event) => setForm((current) => ({ ...current, archiveDirectory: event.target.value }))}
            />
          </label>
        </section>

        <section className="mt-6 border-t border-[var(--color-border)] pt-5">
          <h3 className="mb-4 text-base font-semibold text-[var(--color-text-strong)]">Log Retention Settings</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['archiveOlderThanDays', 'Archive older than days'],
              ['deleteOlderThanDays', 'Delete older than days'],
              ['cleanupFrequencyMinutes', 'Cleanup frequency minutes'],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-sm font-semibold text-[var(--color-text-strong)]">{label}</span>
                <InputNumber
                  className="w-full"
                  inputClassName="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                  value={form[key as keyof ConfigForm] as number}
                  onValueChange={(e) => updateNumber(key as keyof ConfigForm, e.value)}
                  min={1}
                />
              </label>
            ))}
            <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">Cleanup automation</p>
                <p className="text-xs text-[var(--color-text-muted)]">Apply retention cleanup on the configured cadence.</p>
              </div>
              <Checkbox
                checked={form.cleanupAutomationEnabled}
                onChange={(event) => setForm((current) => ({ ...current, cleanupAutomationEnabled: event.checked ?? false }))}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 border-t border-[var(--color-border)] pt-5">
          <h3 className="text-base font-semibold text-[var(--color-text-strong)] mb-4">Self-Healing Recovery Safeguards</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-[var(--color-text-strong)]">Max Auto Restart Attempts</span>
              <InputNumber
                className="w-full"
                inputClassName="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                value={form.maxRestartAttempts}
                onValueChange={(e) => updateNumber('maxRestartAttempts', e.value)}
                min={1}
                max={10}
              />
              <p className="text-xs text-[var(--color-text-muted)]">Maximum number of automated restart trials before cooling down.</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-semibold text-[var(--color-text-strong)]">Cooldown Interval (Minutes)</span>
              <InputNumber
                className="w-full"
                inputClassName="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                value={form.restartCooldownMinutes}
                onValueChange={(e) => updateNumber('restartCooldownMinutes', e.value)}
                min={1}
                max={120}
              />
              <p className="text-xs text-[var(--color-text-muted)]">Wait time to check service health before attempting another healing cycle.</p>
            </label>
          </div>
        </section>

        <section className="mt-6 border-t border-[var(--color-border)] pt-5">
          <h3 className="text-base font-semibold text-[var(--color-text-strong)] mb-4">External Notification Channels</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 md:col-span-3">
              <span className="text-sm font-semibold text-[var(--color-text-strong)]">Slack Webhook URL</span>
              <InputText
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                value={form.slackWebhookUrl}
                onChange={(e) => setForm((current) => ({ ...current, slackWebhookUrl: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
              />
              <p className="text-xs text-[var(--color-text-muted)]">Real-time alerts sent directly to your Slack channel.</p>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-semibold text-[var(--color-text-strong)]">Telegram Bot Token</span>
              <InputText
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                value={form.telegramBotToken}
                onChange={(e) => setForm((current) => ({ ...current, telegramBotToken: e.target.value }))}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-semibold text-[var(--color-text-strong)]">Telegram Chat ID</span>
              <InputText
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                value={form.telegramChatId}
                onChange={(e) => setForm((current) => ({ ...current, telegramChatId: e.target.value }))}
                placeholder="-100123456789"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-surface)]">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-[var(--color-text-strong)]">Automation execution</p>
                <p className="text-sm text-[var(--color-text-muted)]">Reviewed dashboard findings remain the execution boundary.</p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
              <Checkbox
                checked={form.automationEnabled}
                onChange={(event) => setForm((current) => ({ ...current, automationEnabled: event.checked ?? false }))}
              />
              Enabled
            </label>
          </div>
        </section>
      </form>
    </div>
    </>
  )
}
