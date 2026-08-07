import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from 'primereact/button'
import { CrudPage } from '@/components/crud/CrudPage'
import {
  createTimelyFilingAlertFormConfig,
  createTimelyFilingAlertTableColumns,
  getTimelyFilingAlertLabel,
  mapTimelyFilingAlertFormToPayload,
  mapTimelyFilingAlertToFormValues,
  renderTimelyFilingAlertDetails,
  renderTimelyFilingAlertGridItem,
  type TimelyFilingAlertCreatePayload,
  type TimelyFilingAlertFormValues,
  type TimelyFilingAlertUpdatePayload,
} from '@/models/timelyFilingAlertModel'
import {
  useGetTimelyFilingAlertsQuery,
  useRefreshTimelyFilingAlertsMutation,
} from '@/services/api/endpoints/timelyFilingAlertsApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useToast } from '@/hooks/useToast'
import type { TimelyFilingAlert } from '@/types/timelyFilingAlert'
import type { CrudPageConfig, CrudPageState } from '@/types/crud'

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--color-text-strong)]">{value}</p>
    </div>
  )
}

function TimelyFilingSummary({ state }: { state: CrudPageState<TimelyFilingAlert> }) {
  const alerts = state.items
  const riskAlerts = alerts.filter((alert) => ['WARNING', 'CRITICAL', 'EXPIRED'].includes(alert.status)).length
  const criticalAlerts = alerts.filter((alert) => alert.status === 'CRITICAL').length
  const expiredAlerts = alerts.filter((alert) => alert.status === 'EXPIRED').length
  const zapierFailures = alerts.filter((alert) => alert.zapierDeliveryStatus === 'FAILED').length

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <SummaryTile label="Risk alerts" value={riskAlerts} />
      <SummaryTile label="Critical" value={criticalAlerts} />
      <SummaryTile label="Expired" value={expiredAlerts} />
      <SummaryTile label="Zapier failures" value={zapierFailures} />
    </section>
  )
}

export function TimelyFilingAlertsPage() {
  const { showToast } = useToast()
  const [refreshAlerts, refreshState] = useRefreshTimelyFilingAlertsMutation()

  const crudConfig: CrudPageConfig<
    TimelyFilingAlert,
    TimelyFilingAlertFormValues,
    TimelyFilingAlertCreatePayload,
    TimelyFilingAlertUpdatePayload
  > = useMemo(
    () => ({
      title: 'Timely Filing Alerts',
      eyebrow: 'RCM Compliance',
      description: 'Monitor claim filing windows, payer deadlines, and outbound alert delivery.',
      resourceName: 'Timely Filing Alert',
      viewDialogTitle: 'Timely filing alert details',
      emptyMessage: 'No timely filing alerts found.',
      exportFileName: 'timely-filing-alerts',
      showCreateButton: false,
      pageSizeOptions: [10, 20, 50],
      defaultViewMode: 'list',
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      getRowId: (item) => item._id,
      getRowLabel: getTimelyFilingAlertLabel,
      table: {
        columns: createTimelyFilingAlertTableColumns(),
      },
      form: createTimelyFilingAlertFormConfig(),
      api: {
        useListQuery: useGetTimelyFilingAlertsQuery,
      },
      mapItemToFormValues: mapTimelyFilingAlertToFormValues,
      mapFormValuesToCreatePayload: mapTimelyFilingAlertFormToPayload,
      mapFormValuesToUpdatePayload: () => ({}),
      rowClassName: (item) =>
        item.status === 'EXPIRED'
          ? 'bg-red-50/40'
          : item.status === 'CRITICAL'
            ? 'bg-orange-50/40'
            : item.status === 'WARNING'
              ? 'bg-amber-50/40'
              : '',
      slots: {
        beforeContent: (state) => <TimelyFilingSummary state={state} />,
        toolbarRight: (state) => (
          <Button
            type="button"
            label={refreshState.isLoading ? 'Scanning' : 'Run Scan'}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            loading={refreshState.isLoading}
            className="flex h-8 items-center gap-1 px-3 text-xs font-semibold"
            onClick={async () => {
              try {
                const result = await refreshAlerts().unwrap()
                showToast({
                  severity: 'success',
                  summary: 'Scan completed',
                  detail: `${result.alertsUpdated} alerts updated from ${result.scannedClaims} open claims.`,
                })
                state.refetch()
              } catch (error) {
                showToast({
                  severity: 'error',
                  summary: 'Scan failed',
                  detail: getApiErrorMessage(error),
                })
              }
            }}
          />
        ),
        viewContent: renderTimelyFilingAlertDetails,
        gridItem: renderTimelyFilingAlertGridItem,
      },
      style: {
        viewDialogWidth: 'min(96vw, 72rem)',
      },
    }),
    [refreshAlerts, refreshState.isLoading, showToast],
  )

  return <CrudPage config={crudConfig} />
}
