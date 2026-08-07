import type { ClaimPrediction } from '@/types/claimPrediction'
import type { CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from './rcmReferenceOptions'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/utils/format'
import { Progress } from '@/components/ui/progress'

export const claimPredictionApiDetails = {
  endpoint: 'rcm/claim-predictions',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
  filterQueryParam: 'filter',
}

export function createClaimPredictionTableColumns(
  _options: RcmReferenceOptions,
): CrudTableColumn<ClaimPrediction>[] {
  return [
    {
      key: 'cptCode',
      header: 'CPT Code',
      field: 'cptCode',
      sortField: 'cptCode',
      sortable: true,
      filter: { key: 'cptCode', type: 'contains', input: 'text' },
    },
    {
      key: 'payerId',
      header: 'Payer',
      field: 'payerId',
      sortField: 'payerId',
      sortable: true,
      filter: { key: 'payerId', type: 'contains', input: 'text' },
    },
    {
      key: 'patientId',
      header: 'Patient ID',
      field: 'patientId',
      sortField: 'patientId',
      sortable: true,
      filter: { key: 'patientId', type: 'equals', input: 'text' },
    },
    {
      key: 'workflowStage',
      header: 'Stage',
      field: 'workflowStage',
      sortField: 'workflowStage',
      sortable: true,
      render: (item) => item.workflowStage || 'Pre-Submission',
      exportValue: (item) => item.workflowStage || 'Pre-Submission',
    },
    {
      key: 'pricingContext',
      header: 'Pricing Context',
      field: 'feeScheduleMatchLevel',
      render: (item) => [
        item.feeScheduleMatchLevel || 'fallback',
        item.pricingState,
        item.placeOfServiceCode ? `POS ${item.placeOfServiceCode}` : undefined,
      ].filter(Boolean).join(' / '),
      exportValue: (item) => [
        item.feeScheduleMatchLevel || 'fallback',
        item.pricingState,
        item.placeOfServiceCode ? `POS ${item.placeOfServiceCode}` : undefined,
      ].filter(Boolean).join(' / '),
    },
    {
      key: 'predictedAllowed',
      header: 'Predicted Allowed',
      field: 'predictedAllowed',
      sortField: 'predictedAllowed',
      sortable: true,
      render: (item) => formatCurrency(Number(item.predictedAllowed)),
      exportValue: (item) => item.predictedAllowed,
    },
    {
      key: 'riskLevel',
      header: 'Risk',
      field: 'riskLevel',
      sortField: 'riskLevel',
      sortable: true,
      render: (item) => {
        const risk = String(item.riskLevel || 'Low')
        const variant =
          risk === 'Critical' || risk === 'High'
            ? 'destructive'
            : risk === 'Medium'
              ? 'warning'
              : 'success'
        return <Badge variant={variant} className="capitalize">{risk}</Badge>
      },
      exportValue: (item) => item.riskLevel || 'Low',
    },
    {
      key: 'predictedPaid',
      header: 'Predicted Paid',
      field: 'predictedPaid',
      sortField: 'predictedPaid',
      sortable: true,
      render: (item) => formatCurrency(Number(item.predictedPaid)),
      exportValue: (item) => item.predictedPaid,
    },
    {
      key: 'confidenceScore',
      header: 'Confidence',
      field: 'confidenceScore',
      sortField: 'confidenceScore',
      render: (item) => {
        const score = Math.round(Number(item.confidenceScore) * 100)

        return (
          <div className="flex flex-col gap-1 w-24">
            <span className="text-xs font-medium">{score}%</span>
            <Progress value={score} className="h-1" />
          </div>
        )
      },
      exportValue: (item) => item.confidenceScore,
    },
    {
      key: 'source',
      header: 'Source',
      field: 'source',
      sortField: 'source',
      render: (item) => {
        const label = String(item.source).replace('_', ' ')
        let variant: 'success' | 'default' | 'secondary' = 'default'
        if (item.source === 'historical' || item.source === 'hybrid') variant = 'success'
        if (item.source === 'ai') variant = 'secondary'
        return <Badge variant={variant} className="capitalize">{label}</Badge>
      },
      exportValue: (item) => item.source,
    },
  ]
}

export function renderClaimPredictionDetails(item: ClaimPrediction, _options: RcmReferenceOptions) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">CPT Code</label>
          <p className="text-lg font-bold">{item.cptCode}</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Payer</label>
          <p className="text-lg font-bold">{item.payerId}</p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Predicted Allowed</label>
          <p className="text-2xl font-black text-primary">{formatCurrency(item.predictedAllowed)}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Predicted Paid</label>
          <p className="text-2xl font-black text-primary">{formatCurrency(item.predictedPaid)}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Patient Resp.</label>
          <p className="text-2xl font-black text-primary">{formatCurrency(item.predictedPatientResponsibility ?? 0)}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workflow Stage</label>
          <p className="text-lg font-bold">{item.workflowStage || 'Pre-Submission'}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fee Schedule Match</label>
          <p className="text-lg font-bold">{item.feeScheduleMatchLevel || 'Fallback'}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">State / POS</label>
          <p className="text-lg font-bold">{item.pricingState || 'Any'} / {item.placeOfServiceCode || 'Any'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Denial Risk</label>
          <div className="flex items-center gap-3">
            <Progress value={(item.denialRiskScore ?? 0) * 100} className="flex-1" />
            <Badge variant={item.riskLevel === 'Critical' || item.riskLevel === 'High' ? 'destructive' : item.riskLevel === 'Medium' ? 'warning' : 'success'}>
              {item.riskLevel || 'Low'}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Historical Sample</label>
          <p className="text-sm font-semibold">{item.sampleSize ?? 0} matching payment lines</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Confidence Score</label>
        <div className="flex items-center gap-3">
          <Progress value={item.confidenceScore * 100} className="flex-1" />
          <span className="font-bold">{Math.round(item.confidenceScore * 100)}%</span>
        </div>
      </div>

      {item.explanation && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Explanation</label>
          <div className="p-4 rounded-md border bg-card text-card-foreground shadow-sm italic text-sm">
            "{item.explanation}"
          </div>
        </div>
      )}

      {!!item.riskFactors?.length && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Risk Factors</label>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {item.riskFactors.map((factor) => <li key={factor}>{factor}</li>)}
          </ul>
        </div>
      )}

      {!!item.nextBestActions?.length && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Next Best Actions</label>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {item.nextBestActions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
