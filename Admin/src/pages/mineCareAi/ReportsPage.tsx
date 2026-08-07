import { useState } from 'react'
import { Clipboard, Download, FileText } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { useGenerateMineCareExecutiveReportMutation } from '@/services/api/endpoints/mineCareAiApi'
import { apiClient } from '@/services/api/axiosInstance'
import {
  ActionTable,
  AlertTable,
  DetailGrid,
  MineCarePage,
  RiskTable,
  ServiceTable,
  SparePartTable,
  SummaryCard,
  SurfacePanel,
  WarrantyClaimTable,
  formatCurrency,
  formatDate,
} from './shared'

function ReportScrollSection({ children }: { children: React.ReactNode }) {
  return <div className="max-h-[28rem] overflow-y-auto pr-1">{children}</div>
}

export function MineCareReportsPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [generateReport, { data, isLoading }] = useGenerateMineCareExecutiveReportMutation()
  const [copied, setCopied] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const copyReport = async () => {
    if (!data) return
    const reportText = [
      `MineCare AI ${data.period} executive report`,
      `Generated: ${formatDate(data.generatedAt)}`,
      `Total equipment: ${data.summary.totalEquipment ?? 0}`,
      `Critical assets: ${data.summary.criticalAssets ?? 0}`,
      `Upcoming services: ${data.summary.upcomingServices ?? 0}`,
      `Warranty alerts: ${data.summary.warrantyAlerts ?? 0}`,
      `Claim opportunities: ${data.summary.warrantyClaimOpportunities ?? 0}`,
      `Cost exposure: ${formatCurrency(data.budgetForecast.costExposure)}`,
      `Potential savings: ${formatCurrency(data.budgetForecast.potentialSavings)}`,
      '',
      'Recommended actions:',
      ...data.recommendedActions.map((action) => `- [${action.priority}] ${action.equipment}: ${action.action}`),
    ].join('\n')
    await navigator.clipboard.writeText(reportText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const downloadReport = async () => {
    if (!data) return
    const reportPeriod = data.period === 'monthly' ? 'monthly' : 'weekly'
    setDownloadError('')
    setIsDownloadingPdf(true)
    try {
      const response = await apiClient.post('/minecare-ai/reports/executive/pdf', { period: reportPeriod }, {
        responseType: 'blob',
        timeout: 180000,
      })
      const disposition = String(response.headers['content-disposition'] ?? '')
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `minecare-ai-${reportPeriod}-executive-report.pdf`
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Unable to download the PDF report. Please generate the report again and retry.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <MineCarePage title="Reports" description="Generate executive-ready MineCare AI summaries for maintenance leadership.">
      <SurfacePanel title="Executive Report" description="Select the reporting period and generate a preview payload for leadership review.">
        <div className="flex flex-col gap-3 md:flex-row">
          <Dropdown
            value={period}
            options={[
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
            onChange={(event) => setPeriod(event.value)}
            className="w-full md:max-w-xs"
          />
          <Button label="Generate" icon={<FileText className="h-4 w-4" />} loading={isLoading} onClick={() => generateReport({ period })} />
          {data ? <Button label="Download PDF" icon={<Download className="h-4 w-4" />} severity="secondary" outlined loading={isDownloadingPdf} onClick={downloadReport} /> : null}
          {data ? <Button label={copied ? 'Copied' : 'Copy Report'} icon={<Clipboard className="h-4 w-4" />} severity="secondary" outlined onClick={copyReport} /> : null}
        </div>
        {downloadError ? <p className="mt-3 text-sm text-red-600">{downloadError}</p> : null}
      </SurfacePanel>
      {data ? (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Critical Assets" value={data.summary.criticalAssets ?? 0} icon={FileText} />
            <SummaryCard label="Upcoming Services" value={data.summary.upcomingServices ?? 0} icon={FileText} />
            <SummaryCard label="Warranty Alerts" value={data.summary.warrantyAlerts ?? 0} icon={FileText} />
            <SummaryCard label="Budget Exposure" value={formatCurrency(data.budgetForecast.costExposure)} icon={FileText} />
            <SummaryCard label="AI Estimated Savings" value={formatCurrency(data.savings?.totalEstimatedSavings ?? data.summary.potentialSavings ?? 0)} icon={FileText} />
          </div>

          <SurfacePanel title="Executive Summary">
            <DetailGrid
              values={{
                Period: data.period,
                Generated: formatDate(data.generatedAt),
                'Total Equipment': data.summary.totalEquipment ?? 0,
                'Service Alerts': data.summary.serviceAlerts ?? 0,
                'Claim Opportunities': data.summary.warrantyClaimOpportunities ?? 0,
                'Potential Savings': formatCurrency(data.summary.potentialSavings ?? 0),
                'Downtime Avoided': formatCurrency(data.savings?.estimatedDowntimeAvoided ?? 0),
                'Warranty Recovery': formatCurrency(data.savings?.warrantyRecoveryOpportunity ?? 0),
              }}
            />
          </SurfacePanel>

          <div className="grid gap-4 xl:grid-cols-2">
            <SurfacePanel title="Critical Assets">
              <ReportScrollSection>
                <RiskTable risks={data.criticalAssets} />
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Upcoming Services">
              <ReportScrollSection>
                <ServiceTable services={data.upcomingServices} />
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Warranty Alerts">
              <ReportScrollSection>
                <AlertTable alerts={data.warrantyAlerts} />
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Warranty Claim Opportunities">
              <ReportScrollSection>
                <WarrantyClaimTable claims={data.warrantyClaimOpportunities ?? []} />
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Spare Part Shortages">
              <ReportScrollSection>
                <SparePartTable parts={data.sparePartRequirements} />
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Budget Forecast">
              <DetailGrid
                values={{
                  Month: data.budgetForecast.month,
                  'Maintenance Budget': formatCurrency(data.budgetForecast.monthlyMaintenanceBudget),
                  'Service Cost': formatCurrency(data.budgetForecast.serviceCost),
                  'Risk Buffer': formatCurrency(data.budgetForecast.riskBuffer),
                  'Cost Exposure': formatCurrency(data.budgetForecast.costExposure),
                  'Potential Savings': formatCurrency(data.budgetForecast.potentialSavings),
                }}
              />
            </SurfacePanel>
          </div>

          <SurfacePanel title="Recommended Actions">
            <ReportScrollSection>
              <ActionTable actions={data.recommendedActions} />
            </ReportScrollSection>
          </SurfacePanel>

          <div className="grid gap-4 xl:grid-cols-2">
            <SurfacePanel title="Root Cause Highlights">
              <ReportScrollSection>
                {(data.rootCauseHighlights ?? []).length ? (
                  <ul className="space-y-2 text-sm text-[var(--color-text)]">{(data.rootCauseHighlights ?? []).map((item) => <li key={item.analysisId}><strong>{item.equipmentName}</strong>: {item.likelyRootCauses[0] || item.problem}</li>)}</ul>
                ) : <p className="text-sm text-[var(--color-text-muted)]">No root cause highlights available.</p>}
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Repair vs Replace Highlights">
              <ReportScrollSection>
                {(data.repairReplaceHighlights ?? []).length ? (
                  <ul className="space-y-2 text-sm text-[var(--color-text)]">{(data.repairReplaceHighlights ?? []).map((item) => <li key={item.analysisId}><strong>{item.equipmentName}</strong>: {item.recommendation} - {item.reason}</li>)}</ul>
                ) : <p className="text-sm text-[var(--color-text-muted)]">No repair/replace highlights available.</p>}
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="Procurement/TCO Insights">
              <ReportScrollSection>
                {(data.procurementInsights ?? []).length ? (
                  <ul className="space-y-2 text-sm text-[var(--color-text)]">{(data.procurementInsights ?? []).map((item) => <li key={item.comparisonId}><strong>{item.bestOption}</strong>: {item.reason}</li>)}</ul>
                ) : <p className="text-sm text-[var(--color-text-muted)]">No procurement insights available.</p>}
              </ReportScrollSection>
            </SurfacePanel>
            <SurfacePanel title="AI Recommendations">
              <ReportScrollSection>
                {(data.aiRecommendations ?? []).length ? (
                  <ul className="space-y-2 text-sm text-[var(--color-text)]">{(data.aiRecommendations ?? []).map((item) => <li key={item.recommendationId}><strong>{item.priority}</strong>: {item.title} - {item.recommendedAction}</li>)}</ul>
                ) : <p className="text-sm text-[var(--color-text-muted)]">No AI recommendations available.</p>}
              </ReportScrollSection>
            </SurfacePanel>
          </div>
        </div>
      ) : null}
    </MineCarePage>
  )
}
