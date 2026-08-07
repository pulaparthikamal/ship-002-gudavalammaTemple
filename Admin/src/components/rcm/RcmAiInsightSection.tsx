import { AlertTriangle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

type InsightVariant = 'rejection' | 'denial' | 'appeal' | 'era-exception' | 'ar-priority'

interface RcmAiInsightSectionProps {
  title: string
  variant: InsightVariant
  insight?: Record<string, unknown>
  confidence?: number
  source?: string
  history?: Array<Record<string, unknown>>
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(asText).filter((item): item is string => Boolean(item))
}

function displayLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())
}

function labelFromValue(value: unknown) {
  const text = asText(value)
  return text ? displayLabel(text) : undefined
}

function formatPercent(value: number | undefined) {
  if (value === undefined) return undefined
  return `${Math.round((value <= 1 ? value * 100 : value) * 10) / 10}%`
}

function formatCurrency(value: number | undefined) {
  if (value === undefined) return undefined
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatDateTime(value: unknown) {
  const text = asText(value)
  if (!text) return undefined
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatScalar(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return undefined
}

function SummaryItem({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--color-text-strong)]">{value}</dd>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--color-text-strong)]">{value}</p>
    </div>
  )
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-strong)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[var(--color-primary)]" aria-hidden="true">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function KeyValueGrid({ entries }: { entries: Array<[string, ReactNode]> }) {
  if (!entries.length) return null
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <SummaryItem key={label} label={displayLabel(label)} value={value} />
      ))}
    </dl>
  )
}

function StructuredValue({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return null

  if (Array.isArray(value)) {
    const primitiveItems = value
      .map(formatScalar)
      .filter((item): item is string => Boolean(item))

    if (primitiveItems.length === value.length) {
      return (
        <ul className="space-y-1">
          {primitiveItems.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="text-[var(--color-primary)]" aria-hidden="true">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    }

    return (
      <div className="space-y-2">
        {value.map((entry, index) => (
          <div key={index} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            <StructuredValue value={entry} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
      .map(([label, entryValue]) => {
        const scalar = formatScalar(entryValue)
        return [
          label,
          scalar ?? <StructuredValue value={entryValue} />,
        ] as [string, ReactNode]
      })

    return <KeyValueGrid entries={entries} />
  }

  return <span>{formatScalar(value)}</span>
}

const primaryInsightKeysByVariant: Record<InsightVariant, Set<string>> = {
  rejection: new Set(['status', 'source', 'confidence', 'priority', 'correctionType', 'correctedClaimRecommended', 'rootCause', 'affectedFields', 'recommendedActions']),
  denial: new Set(['status', 'source', 'confidence', 'recommendation', 'rootCause', 'recommendationReason', 'nextBestAction', 'evidenceNeeded', 'missingDocumentation', 'payerPolicyNotes']),
  appeal: new Set(['status', 'source', 'confidence', 'overturnProbability', 'appealLetterDraft', 'payerSpecificArgument', 'medicalNecessityArgument', 'evidenceChecklist', 'missingDocs']),
  'era-exception': new Set(['status', 'source', 'confidence', 'explanation', 'likelyMatch', 'ambiguityReasons', 'recommendedActions']),
  'ar-priority': new Set(['status', 'source', 'confidence', 'priority', 'financialImpact', 'slaRisk', 'recommendedOwnerQueue', 'reason', 'nextAction']),
}

function AdditionalAiFields({ variant, insight }: { variant: InsightVariant; insight: Record<string, unknown> }) {
  const primaryKeys = primaryInsightKeysByVariant[variant]
  const entries = Object.entries(insight).filter(([key, value]) => !primaryKeys.has(key) && value !== undefined && value !== null && value !== '')
  if (!entries.length) return null

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Additional AI Data</p>
      <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-strong)]">
        <StructuredValue value={Object.fromEntries(entries)} />
      </div>
    </div>
  )
}

function AiHistory({ history }: { history?: Array<Record<string, unknown>> }) {
  const items = (history ?? []).filter((entry) => entry && typeof entry === 'object')
  if (!items.length) return null

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">AI Recommendation History</p>
      <div className="mt-2 space-y-2">
        {items.map((entry, index) => {
          const generatedAt = formatDateTime(entry.generatedAt ?? entry.createdAt ?? entry.timestamp)
          const source = asText(entry.source)
          const confidence = formatPercent(asNumber(entry.confidenceScore ?? entry.confidence))
          return (
            <div key={index} className="rounded-lg border border-[var(--color-border)] p-3">
              {(generatedAt || source || confidence) ? (
                <dl className="mb-3 grid gap-3 sm:grid-cols-3">
                  <SummaryItem label="Generated" value={generatedAt} />
                  <SummaryItem label="Source" value={source} />
                  <SummaryItem label="Confidence" value={confidence} />
                </dl>
              ) : null}
              <StructuredValue value={entry} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MatchingFields({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([label, entryValue]) => [displayLabel(label), asText(entryValue)] as const)
    .filter(([, entryValue]) => Boolean(entryValue))
  if (!entries.length) return null

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Possible Match</p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {entries.map(([label, entryValue]) => (
          <SummaryItem key={label} label={label} value={entryValue} />
        ))}
      </dl>
    </div>
  )
}

function InsightContent({ variant, insight }: { variant: InsightVariant; insight: Record<string, unknown> }) {
  if (variant === 'rejection') {
    const suggested = typeof insight.correctedClaimRecommended === 'boolean' ? insight.correctedClaimRecommended : undefined
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-2">
          <SummaryItem label="Priority" value={labelFromValue(insight.priority)} />
          <SummaryItem label="Correction Type" value={labelFromValue(insight.correctionType)} />
          <SummaryItem label="Corrected Claim Suggested" value={suggested === undefined ? undefined : suggested ? 'Yes' : 'No'} />
        </dl>
        <TextBlock label="Root Cause" value={asText(insight.rootCause)} />
        <ListBlock label="Affected Fields" items={asList(insight.affectedFields)} />
        <ListBlock label="Recommended Actions" items={asList(insight.recommendedActions)} />
      </>
    )
  }

  if (variant === 'denial') {
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-2">
          <SummaryItem label="Recommendation" value={labelFromValue(insight.recommendation)} />
        </dl>
        <TextBlock label="Root Cause" value={asText(insight.rootCause)} />
        <TextBlock label="Recommendation Reason" value={asText(insight.recommendationReason)} />
        <TextBlock label="Next Best Action" value={asText(insight.nextBestAction)} />
        <ListBlock label="Evidence Needed" items={asList(insight.evidenceNeeded)} />
        <ListBlock label="Missing Documentation" items={asList(insight.missingDocumentation)} />
        <ListBlock label="Payer Policy Notes" items={asList(insight.payerPolicyNotes)} />
      </>
    )
  }

  if (variant === 'appeal') {
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-2">
          <SummaryItem label="Overturn Probability" value={formatPercent(asNumber(insight.overturnProbability))} />
        </dl>
        <TextBlock label="Appeal Letter Draft" value={asText(insight.appealLetterDraft)} />
        <TextBlock label="Payer Argument" value={asText(insight.payerSpecificArgument)} />
        <TextBlock label="Medical Necessity Argument" value={asText(insight.medicalNecessityArgument)} />
        <ListBlock label="Evidence Checklist" items={asList(insight.evidenceChecklist)} />
        <ListBlock label="Missing Documents" items={asList(insight.missingDocs)} />
      </>
    )
  }

  if (variant === 'era-exception') {
    return (
      <>
        <TextBlock label="Explanation" value={asText(insight.explanation)} />
        <MatchingFields value={insight.likelyMatch} />
        <ListBlock label="Ambiguity Reasons" items={asList(insight.ambiguityReasons)} />
        <ListBlock label="Recommended Validation Steps" items={asList(insight.recommendedActions)} />
      </>
    )
  }

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <SummaryItem label="Priority" value={labelFromValue(insight.priority)} />
        <SummaryItem label="Financial Impact" value={formatCurrency(asNumber(insight.financialImpact))} />
        <SummaryItem label="SLA Risk" value={labelFromValue(insight.slaRisk)} />
        <SummaryItem label="Owner Queue" value={labelFromValue(insight.recommendedOwnerQueue)} />
      </dl>
      <TextBlock label="Reason" value={asText(insight.reason)} />
      <TextBlock label="Next Action" value={asText(insight.nextAction)} />
    </>
  )
}

export function RcmAiInsightSection({ title, variant, insight, confidence, source, history }: RcmAiInsightSectionProps) {
  if (!insight) return null

  const status = asText(insight.status)
  const resolvedConfidence = confidence ?? asNumber(insight.confidence)
  const resolvedSource = source ?? asText(insight.source)
  const isFallback = status?.toLowerCase() === 'fallback'

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[var(--color-primary-soft)] px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
            AI advisory
          </span>
          {status ? (
            <span className="rounded-lg bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
              {displayLabel(status)}
            </span>
          ) : null}
        </div>
      </div>
      {isFallback ? (
        <div className="flex gap-2 rounded-lg border border-[var(--color-warning-text)]/30 bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>The AI service was unavailable. Review this fallback result manually before taking any action.</p>
        </div>
      ) : null}
      <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
        {(resolvedSource || resolvedConfidence !== undefined) ? (
          <dl className="grid gap-4 border-b border-[var(--color-border)] pb-4 sm:grid-cols-2">
            <SummaryItem label="Source" value={resolvedSource} />
            <SummaryItem label="Confidence" value={formatPercent(resolvedConfidence)} />
          </dl>
        ) : null}
        <InsightContent variant={variant} insight={insight} />
        <AdditionalAiFields variant={variant} insight={insight} />
        <AiHistory history={history} />
      </div>
    </section>
  )
}
