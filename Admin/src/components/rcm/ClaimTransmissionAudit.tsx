import React, { useMemo } from 'react'
import { 
  Send, 
  CheckCircle2, 
  FileCode, 
  Globe, 
  Database,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  ClipboardList,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/utils/classNames'
import { useGetClaimSubmissionsQuery } from '@/services/api/endpoints/claimSubmissionsApi'
import type { Claim } from '@/types/claim'

interface ClaimTransmissionAuditProps {
  claim: Claim
}

export function ClaimTransmissionAudit({ claim }: ClaimTransmissionAuditProps) {
  const submissionQuery = useGetClaimSubmissionsQuery(
    {
      page: 1,
      limit: 1,
      sortfield: 'submissionDateTime',
      direction: 'desc',
      criteria: [
        {
          key: 'claimId',
          value: claim._id,
          type: 'equals',
        },
      ],
    },
    { skip: !claim._id },
  )
  const submission = submissionQuery.data?.data?.[0]
  const transmissionStatus = submission?.transmissionStatus ?? claim.submissionStatus ?? 'Not Submitted'
  const acknowledgementStatus = submission?.acknowledgementStatus ?? claim.ediStatus ?? 'Not Received'
  const isTransmitted = ['Transmitted', 'Acknowledged', 'Printed'].includes(transmissionStatus)
  const payloadSnapshot = useMemo(() => {
    if (!submission?.payloadSnapshot) {
      return null
    }

    try {
      return JSON.stringify(JSON.parse(submission.payloadSnapshot), null, 2)
    } catch {
      return submission.payloadSnapshot
    }
  }, [submission?.payloadSnapshot])
  const operationalSummary = useMemo(() => {
    if (!submission) {
      return 'No submission record exists yet. The claim has not reached the transmission ledger.'
    }

    if (submission.submissionErrorMessage) {
      return submission.submissionErrorMessage
    }

    if (submission.transmissionStatus === 'Printed') {
      return 'Paper claim packet generated. Manual print-and-mail workflow is still required.'
    }

    if (submission.acknowledgementStatus && submission.acknowledgementStatus !== 'Pending Acknowledgement') {
      return `Latest acknowledgement: ${submission.acknowledgementStatus}.`
    }

    return 'Electronic claim transmitted successfully. Waiting for payer or clearinghouse acknowledgement.'
  }, [submission])
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner",
            isTransmitted ? "bg-[#f0f7ff] text-[#102a43]" : "bg-neutral-50 text-neutral-400"
          )}>
            <Send className={cn("h-7 w-7", isTransmitted && "animate-pulse")} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-neutral-900">EDI transmission Audit</h3>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
              <Globe className="h-4 w-4" />
              {submission?.clearinghouseName || claim.clearingHouse || 'No Clearinghouse Assigned'}
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              Batch: {submission?.batchId || claim.batchId || 'N/A'}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm border",
            isTransmitted 
              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
              : "bg-amber-50 text-amber-700 border-amber-100"
          )}>
            {isTransmitted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {transmissionStatus}
          </span>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Payer Gateway Status</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col rounded-2xl border border-neutral-100 bg-[#0f172a] shadow-xl overflow-hidden">
          <div className="flex items-center justify-between bg-white/5 px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Submission Payload Snapshot</span>
            </div>
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">
              {submission?.submissionFileType || claim.claimType || 'Pending'}
            </span>
          </div>
          <div className="p-4 font-mono text-[11px] leading-relaxed text-sky-200/80 overflow-x-auto">
            {submissionQuery.isFetching ? (
              <div className="flex h-48 flex-col items-center justify-center text-neutral-500 italic">
                Loading transmission record...
              </div>
            ) : payloadSnapshot ? (
              <pre className="whitespace-pre-wrap">{payloadSnapshot}</pre>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-neutral-500 italic">
                No persisted payload snapshot is available for this claim yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-900 mb-4">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Verification Chain
            </h4>
            <div className="space-y-4">
              <AuditStep label="Clinical Lock" status={claim.claimStatus ?? 'Draft'} icon={<ClipboardList className="h-3.5 w-3.5" />} active={claim.claimStatus !== 'Draft'} />
              <AuditStep label="Coding Scrub" status={claim.scrubStatus ?? 'Pending'} icon={<ShieldCheck className="h-3.5 w-3.5" />} active={claim.scrubStatus === 'Passed'} />
              <AuditStep label="Transmission" status={transmissionStatus} icon={<Database className="h-3.5 w-3.5" />} active={Boolean(submission)} />
              <AuditStep label="Payer Acknowledgement" status={acknowledgementStatus} icon={<ArrowRightLeft className="h-3.5 w-3.5" />} active={isTransmitted} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-primary-soft)]/20 bg-[#f0f7ff] p-5">
            <h4 className="text-sm font-bold text-[#102a43] mb-2 uppercase tracking-wide">Submission Notes</h4>
            <div className="space-y-2 text-xs font-medium text-[#102a43]/80 leading-relaxed">
              <p>{operationalSummary}</p>
              <p>Trace ID: {submission?.submissionTraceId || 'Not assigned'}</p>
              <p>Method: {submission?.submissionMethod || 'Pending'} • Submitted: {submission?.submissionDateTime ? new Date(submission.submissionDateTime).toLocaleString() : 'Not submitted'}</p>
              {submission?.submissionErrorCode ? (
                <p className="inline-flex items-center gap-1 text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Error code: {submission.submissionErrorCode}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuditStep({ label, status, icon, active }: { label: string, status: string, icon: React.ReactNode, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between border-l-2 pl-3 py-1 transition-all",
      active ? "border-emerald-500 opacity-100" : "border-neutral-200 opacity-50"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", active ? "bg-emerald-100 text-emerald-600" : "bg-neutral-100 text-neutral-400")}>
          {icon}
        </div>
        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-tight">{label}</span>
      </div>
      <span className={cn("text-[10px] font-bold", active ? "text-emerald-700" : "text-neutral-400")}>{status}</span>
    </div>
  )
}
