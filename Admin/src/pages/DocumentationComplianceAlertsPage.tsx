import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from 'primereact/button'
import { CrudPage } from '@/components/crud/CrudPage'
import {
  createDocumentationComplianceAlertFormConfig,
  createDocumentationComplianceAlertTableColumns,
  getDocumentationComplianceAlertLabel,
  mapDocumentationComplianceAlertFormToPayload,
  mapDocumentationComplianceAlertToFormValues,
  renderDocumentationComplianceAlertDetails,
  renderDocumentationComplianceAlertGridItem,
  type DocumentationComplianceAlertCreatePayload,
  type DocumentationComplianceAlertFormValues,
  type DocumentationComplianceAlertUpdatePayload,
} from '@/models/documentationComplianceAlertModel'
import {
  useGetDocumentationComplianceAlertsQuery,
  useRefreshDocumentationComplianceAlertsMutation,
} from '@/services/api/endpoints/documentationComplianceAlertsApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useToast } from '@/hooks/useToast'
import type { DocumentationComplianceAlert } from '@/types/documentationComplianceAlert'
import type { CrudPageConfig, CrudPageState } from '@/types/crud'

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--color-text-strong)]">{value}</p>
    </div>
  )
}

function DocumentationComplianceSummary({ state }: { state: CrudPageState<DocumentationComplianceAlert> }) {
  const alerts = state.items
  const failedAlerts = alerts.filter((alert) => alert.status === 'FAIL').length
  const highSeverityAlerts = alerts.filter((alert) => alert.severity === 'HIGH').length
  const missingDocuments = alerts.reduce((total, alert) => total + alert.missingDocuments.length, 0)
  const zapierFailures = alerts.filter((alert) => alert.zapierDeliveryStatus === 'FAILED').length

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <SummaryTile label="Failed claims" value={failedAlerts} />
      <SummaryTile label="High severity" value={highSeverityAlerts} />
      <SummaryTile label="Missing docs" value={missingDocuments} />
      <SummaryTile label="Zapier failures" value={zapierFailures} />
    </section>
  )
}

export function DocumentationComplianceAlertsPage() {
  const { showToast } = useToast()
  const [refreshAlerts, refreshState] = useRefreshDocumentationComplianceAlertsMutation()

  const crudConfig: CrudPageConfig<
    DocumentationComplianceAlert,
    DocumentationComplianceAlertFormValues,
    DocumentationComplianceAlertCreatePayload,
    DocumentationComplianceAlertUpdatePayload
  > = useMemo(
    () => ({
      title: 'Documentation Compliance Alerts',
      eyebrow: 'RCM Compliance',
      description: 'Monitor missing claim support, documentation rules, and outbound alert delivery.',
      resourceName: 'Documentation Compliance Alert',
      viewDialogTitle: 'Documentation compliance alert details',
      emptyMessage: 'No documentation compliance alerts found.',
      exportFileName: 'documentation-compliance-alerts',
      showCreateButton: false,
      pageSizeOptions: [10, 20, 50],
      defaultViewMode: 'list',
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [{ key: 'active', value: true, type: 'eq' }],
      },
      getRowId: (item) => item._id,
      getRowLabel: getDocumentationComplianceAlertLabel,
      table: {
        columns: createDocumentationComplianceAlertTableColumns(),
      },
      form: createDocumentationComplianceAlertFormConfig(),
      api: {
        useListQuery: useGetDocumentationComplianceAlertsQuery,
      },
      mapItemToFormValues: mapDocumentationComplianceAlertToFormValues,
      mapFormValuesToCreatePayload: mapDocumentationComplianceAlertFormToPayload,
      mapFormValuesToUpdatePayload: () => ({}),
      rowClassName: (item) =>
        item.status === 'FAIL'
          ? item.severity === 'HIGH'
            ? 'bg-red-50/40'
            : 'bg-amber-50/40'
          : '',
      slots: {
        beforeContent: (state) => <DocumentationComplianceSummary state={state} />,
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
        viewContent: renderDocumentationComplianceAlertDetails,
        gridItem: renderDocumentationComplianceAlertGridItem,
      },
      style: {
        viewDialogWidth: 'min(96vw, 72rem)',
      },
    }),
    [refreshAlerts, refreshState.isLoading, showToast],
  )

  return <CrudPage config={crudConfig} />
}
