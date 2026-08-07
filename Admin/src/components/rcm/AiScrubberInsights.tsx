import { useState } from 'react'
import { 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  ClipboardList,
  Fingerprint,
  Zap,
  DollarSign,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/utils/classNames'
import type { CodingReview } from '@/types/codingReview'
import type { ClaimPrediction } from '@/types/claimPrediction'

interface AiScrubberInsightsProps {
  review: CodingReview
  predictions?: ClaimPrediction[]
}

export function AiScrubberInsights({ review, predictions = [] }: AiScrubberInsightsProps) {
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  
  const toggleLine = (id: string) => {
    setExpandedLines(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isPassed = review.scrubStatus === 'Passed' || review.scrubStatus === 'Approved' || review.scrubStatus === 'Approved for Billing'

  const totalExpectedAllowed = predictions.reduce((sum, p) => sum + (p.predictedAllowed || 0), 0);
  const totalEstimatedPaid = predictions.reduce((sum, p) => sum + (p.predictedPaid || 0), 0);
  const totalPatientResp = predictions.reduce((sum, p) => sum + (p.predictedPatientResponsibility || 0), 0);
  const totalChargeAmount = predictions.reduce((sum, p) => sum + (p.chargeAmount || 0), 0);
  const selfPayPredictionCount = predictions.filter(isSelfPayPrediction).length;
  const missingBenefitPredictionCount = predictions.filter(hasMissingBenefitContext).length;
  const verifiedBenefitPredictionCount = predictions.filter(hasVerifiedBenefitContext).length;
  const paymentBasis =
    predictions.length === 0
      ? 'Not predicted'
      : selfPayPredictionCount === predictions.length
        ? 'Self-pay / patient responsibility'
        : verifiedBenefitPredictionCount > 0
          ? 'Insurance benefit estimate'
          : missingBenefitPredictionCount > 0
          ? 'Insurance estimate without verified benefits'
          : 'Insurance benefit estimate'
  
  const avgExpectedAllowedPct = totalChargeAmount > 0 ? totalExpectedAllowed / totalChargeAmount : 0;
  const avgExpectedPaidPct = totalChargeAmount > 0 ? totalEstimatedPaid / totalChargeAmount : 0;
  
  return (
    <div className="space-y-5">
      <div className={cn(
        "rounded-lg border p-5 shadow-sm",
        isPassed 
          ? "border-[var(--color-success-soft)] bg-[var(--color-success-soft)]/15" 
          : "border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/15"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg",
              isPassed ? "bg-[var(--color-success-soft)] text-[var(--color-success-text)]" : "bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]"
            )}>
              {isPassed ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-strong)]">AI Scrub Analysis</h3>
              <p className={cn(
                "text-sm font-semibold",
                isPassed ? "text-[var(--color-success-text)]" : "text-[var(--color-danger-text)]"
              )}>
                Status: {review.scrubStatus} • Risk: {review.codingRiskLevel}
              </p>
            </div>
          </div>

          <span className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
            isPassed
              ? "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success-text)]"
              : "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]"
          )}>
            {isPassed ? 'Ready for claim' : 'Needs correction'}
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[var(--color-danger-text)]" />
            <h4 className="font-bold text-[var(--color-text-strong)]">Compliance & Edits</h4>
          </div>
          
          <div className="space-y-3">
            {review.validationErrors?.length ? (
              review.validationErrors.map((error, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/20 p-3 text-xs font-medium text-[var(--color-danger-text)]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)]/20 p-3 text-xs font-medium text-[var(--color-success-text)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                No blocking compliance issues found.
              </div>
            )}
            
            <div className="mt-4 grid grid-cols-2 gap-2">
              <FlagItem label="NCCI Edit" active={review.ncciEditFlag} />
              <FlagItem label="LCD/NCD" active={review.lcdNcdEditFlag} />
              <FlagItem label="ICD-CPT Match" active={!review.icdCptMismatchFlag} invert />
              <FlagItem label="Documentation" active={!review.missingDocumentationFlag} invert />
            </div>
          </div>
        </div>
      </div>

      {review.codingValidationResults && review.codingValidationResults.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-[var(--color-primary)]" />
            <h4 className="font-bold text-[var(--color-text-strong)]">Manual Code Validation</h4>
          </div>

          <div className="grid gap-3">
            {review.codingValidationResults.map((result, idx) => {
              const isValid = result.status === 'Valid';
              const isWarning = result.status === 'Optimization Suggested';
              
              return (
                <div key={idx} className={cn(
                  "flex flex-col gap-2 rounded-lg border p-4 transition-all",
                  isValid ? "border-[var(--color-success-soft)] bg-[var(--color-success-soft)]/15" : 
                  isWarning ? "border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)]/15" : 
                  "border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/15"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--color-text-strong)]">{result.code}</span>
                      <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">({result.codeType})</span>
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                      isValid ? "bg-[var(--color-success-soft)] text-[var(--color-success-text)]" : 
                      isWarning ? "bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]" : 
                      "bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]"
                    )}>
                      {result.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-[var(--color-text)] leading-relaxed">
                    {result.reasoning}
                  </p>
                  {result.suggestedAlternative && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-[var(--color-primary)]">
                      <Zap className="h-3 w-3" />
                      Suggested Alternative: {result.suggestedAlternative}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {predictions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <DollarSign className="h-5 w-5 text-[var(--color-success-text)]" />
            <h4 className="font-bold text-[var(--color-text-strong)]">Reimbursement Predictions</h4>
            <span className="ml-auto text-[10px] font-bold text-[var(--color-text-muted)] uppercase">
              {predictions.length} Line Items
            </span>
          </div>

          <div className="rounded-lg border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/10 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h5 className="font-bold text-[var(--color-primary)]">Total Claim Estimate</h5>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                {paymentBasis}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">Total Expected Allowed</span>
                <span className="text-xl font-bold text-[var(--color-success-text)]">${totalExpectedAllowed.toFixed(2)}</span>
                {totalChargeAmount > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success-text)]">
                    <TrendingUp className="h-3 w-3" />
                    {Math.round(avgExpectedAllowedPct * 100)}% of total charge
                  </div>
                )}
              </div>
              
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">Total Estimated Insurance Paid</span>
                <span className="text-xl font-bold text-[var(--color-success-text)]">${totalEstimatedPaid.toFixed(2)}</span>
                {totalChargeAmount > 0 && (
                  <div className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                    {Math.round(avgExpectedPaidPct * 100)}% net yield
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">Total Patient Resp.</span>
                <span className="text-xl font-bold text-[var(--color-text-strong)]">${totalPatientResp.toFixed(2)}</span>
              </div>
            </div>
            {totalEstimatedPaid === 0 && totalPatientResp > 0 && selfPayPredictionCount === predictions.length ? (
              <div className="mt-4 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)]/15 px-4 py-3 text-xs font-semibold text-[var(--color-warning-text)]">
                Insurance paid is $0 because these predictions resolved to self-pay. Verify the patient's active insurance policy before treating this as an insurance estimate.
              </div>
            ) : totalEstimatedPaid === 0 && totalPatientResp > 0 && missingBenefitPredictionCount > 0 && verifiedBenefitPredictionCount === 0 ? (
              <div className="mt-4 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)]/15 px-4 py-3 text-xs font-semibold text-[var(--color-warning-text)]">
                Insurance paid is $0 and verified benefit fields were not available. Verify the patient's active insurance policy, payer, and latest eligibility response before treating this as an insurance estimate.
              </div>
            ) : totalEstimatedPaid === 0 && totalPatientResp > 0 && verifiedBenefitPredictionCount > 0 ? (
              <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                Insurance paid is $0 based on applied eligibility benefits. This can be correct when deductible, copay, coinsurance, or out-of-pocket rules assign the allowed amount to patient responsibility.
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {predictions.map((prediction) => {
              const id = prediction._id || prediction.cptCode;
              const isExpanded = expandedLines[id];
              
              return (
                <div key={id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--color-surface-hover)]"
                    onClick={() => toggleLine(id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-14 items-center justify-center rounded bg-[var(--color-success-soft)] text-xs font-bold text-[var(--color-success-text)]">
                        {prediction.cptCode}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block">Procedure Code</span>
                        <span className="text-xs font-bold text-[var(--color-text-strong)]">Line {prediction.lineNumber || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span className="text-sm font-bold text-[var(--color-success-text)]">${prediction.predictedAllowed.toFixed(2)}</span>
                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] block uppercase">Allowed</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 shadow-sm sm:mr-2">
                        <Target className={cn(
                          "h-3 w-3",
                          prediction.confidenceScore > 0.7 ? "text-[var(--color-success-text)]" : "text-[var(--color-warning-text)]"
                        )} />
                        <span className="text-[9px] font-bold text-[var(--color-text)]">
                          {Math.round(prediction.confidenceScore * 100)}%
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-[var(--color-text-muted)]" /> : <ChevronDown className="h-5 w-5 text-[var(--color-text-muted)]" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/30">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                          <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">Expected Allowed</span>
                          <span className="text-xl font-bold text-[var(--color-success-text)]">${prediction.predictedAllowed.toFixed(2)}</span>
                          {prediction.expectedAllowedPercentage !== undefined && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success-text)]">
                              <TrendingUp className="h-3 w-3" />
                              {Math.round(prediction.expectedAllowedPercentage * 100)}% of charge
                            </div>
                          )}
                        </div>
                        
                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                          <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">Estimated Insurance Paid</span>
                          <span className="text-xl font-bold text-[var(--color-success-text)]">${prediction.predictedPaid.toFixed(2)}</span>
                          {prediction.expectedPaidPercentage !== undefined && (
                            <div className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                              {Math.round(prediction.expectedPaidPercentage * 100)}% net yield
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                          <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">Patient Resp.</span>
                          <span className="text-xl font-bold text-[var(--color-text-strong)]">
                            ${(prediction.predictedPatientResponsibility ?? 0).toFixed(2)}
                          </span>
                          <div className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)] italic">
                            {getPredictionPaymentBasis(prediction)}
                          </div>
                        </div>
                      </div>

                      {prediction.explanation && (
                        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 text-[11px] font-medium text-[var(--color-text)]">
                          <span className="font-bold text-[var(--color-success-text)] uppercase text-[9px] block mb-1">Expert Reasoning (Line {prediction.cptCode})</span>
                          {prediction.explanation}
                        </div>
                      )}

                      {prediction.nextBestActions && prediction.nextBestActions.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">Next Steps for {prediction.cptCode}</span>
                          {prediction.nextBestActions.map((action, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] font-semibold text-[var(--color-text)]">
                              <div className="h-1 w-1 rounded-full bg-[var(--color-success-text)]" />
                              {action}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Fingerprint className="h-3 w-3" />
            Scrub ID: {String(review.scrubId || review._id).slice(-8)}
          </span>
          <span className="flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />
            Audit Path: Enc ➔ Chg ➔ Scrub
          </span>
        </div>
        <span>Review captured</span>
      </div>
    </div>
  )
}

function hasPredictionText(prediction: ClaimPrediction, pattern: RegExp) {
  return [
    prediction.explanation,
    ...(prediction.evidence ?? []),
    ...(prediction.riskFactors ?? []),
    ...(prediction.nextBestActions ?? []),
  ].some((value) => pattern.test(value ?? ''))
}

function isSelfPayPrediction(prediction: ClaimPrediction) {
  return hasPredictionText(prediction, /self[-\s]?pay|patient responsibility equals estimated allowed/i)
}

function hasMissingBenefitContext(prediction: ClaimPrediction) {
  return hasPredictionText(prediction, /no active insurance|benefit fields were unavailable|capture or activate insurance|plan active false|eligibility.*unavailable/i)
}

function hasVerifiedBenefitContext(prediction: ClaimPrediction) {
  return hasPredictionText(prediction, /eligibility benefits applied|copay|deductible|coinsurance|out-of-pocket/i)
}

function getPredictionPaymentBasis(prediction: ClaimPrediction) {
  if (isSelfPayPrediction(prediction)) {
    return 'Self-pay or patient-responsibility estimate'
  }

  if (hasVerifiedBenefitContext(prediction)) {
    return 'Insurance benefits applied'
  }

  if (hasMissingBenefitContext(prediction)) {
    return 'Insurance estimate without verified benefits'
  }

  return `Based on ${prediction.source} analytics`
}

function FlagItem({ label, active, invert = false }: { label: string, active?: boolean, invert?: boolean }) {
  const isPositive = invert ? active : !active
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg border px-3 py-2 text-[10px] font-bold uppercase transition-all",
      isPositive 
        ? "border-[var(--color-success-soft)] bg-[var(--color-surface)] text-[var(--color-success-text)]" 
        : "border-[var(--color-danger-soft)] bg-[var(--color-surface)] text-[var(--color-danger-text)]"
    )}>
      <span>{label}</span>
      {isPositive ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
    </div>
  )
}
