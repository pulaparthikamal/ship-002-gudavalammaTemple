import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, FileCheck2, FilePlus2, FileStack, Gavel, Lock, MessageSquareMore, Navigation, Send } from 'lucide-react'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { CrudPage } from '@/components/crud/CrudPage'
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog'
import type { CrudPageConfig, CrudTableAction } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createAppealFormConfig, createAppealTableColumns, mapAppealFormToPayload, mapAppealToFormValues, renderAppealDetails, renderAppealGridItem } from '@/models/appealModel'
import { useAddAppealDocumentMutation, useChangeAppealStatusMutation, useCloseAppealMutation, useGenerateAppealPacketMutation, useGenerateFinalAppealPacketMutation, useGetAppealsQuery, useRecordAppealOutcomeMutation, useRecordAppealPayerReceivedMutation, useRequestAppealMoreInfoMutation, useSubmitAppealEvidenceMutation, useSubmitAppealMutation } from '@/services/api/endpoints/appealsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useGetArWorkItemsQuery } from '@/services/api/endpoints/arWorkItemsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Appeal, AppealCreatePayload, AppealFormValues, AppealUpdatePayload } from '@/types/appeal'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

const appealDocumentTypeOptions = [
  { label: 'Medical Records', value: 'MEDICAL_RECORDS' },
  { label: 'Progress Notes', value: 'PROGRESS_NOTES' },
  { label: 'Authorization Documents', value: 'AUTHORIZATION_DOCUMENTS' },
  { label: 'Referral Documents', value: 'REFERRAL_DOCUMENTS' },
  { label: 'Eligibility Evidence', value: 'ELIGIBILITY_EVIDENCE' },
  { label: 'EOB / ERA Documents', value: 'EOB_ERA_DOCUMENTS' },
  { label: 'Provider Letter', value: 'PROVIDER_LETTER' },
  { label: 'Appeal Letter', value: 'APPEAL_LETTER' },
  { label: 'Custom Attachment', value: 'CUSTOM_ATTACHMENTS' },
]

const appealChannelOptions = [
  { label: 'Portal', value: 'PORTAL' },
  { label: 'Fax', value: 'FAX' },
  { label: 'Email', value: 'EMAIL' },
  { label: 'Mail', value: 'MAIL' },
  { label: 'Manual', value: 'MANUAL' },
]

const appealOutcomeOptions = [
  { label: 'Overturned', value: 'OVERTURNED' },
  { label: 'Partially overturned', value: 'PARTIALLY_OVERTURNED' },
  { label: 'Upheld', value: 'UPHELD' },
]

type AppealOutcome = 'OVERTURNED' | 'PARTIALLY_OVERTURNED' | 'UPHELD'
type AppealWorkflowAction = CrudTableAction<Appeal>

const primaryAppealActionOrder: Record<string, string[]> = {
  DRAFT: ['Add Evidence', 'Generate Packet'],
  PACKET_GENERATED: ['Final Packet', 'Add Evidence'],
  READY: ['Final Packet', 'Submit Appeal'],
  SUBMITTED: ['Payer Received'],
  PAYER_RECEIVED: ['Payer Review'],
  PAYER_REVIEW: ['Record Outcome', 'More Info'],
  IN_REVIEW: ['Record Outcome', 'More Info'],
  MORE_INFO_REQUIRED: ['Add Evidence'],
  EVIDENCE_SUBMITTED: ['Record Outcome'],
  OVERTURNED: ['Close Appeal'],
  PARTIALLY_OVERTURNED: ['Close Appeal'],
  UPHELD: ['Close Appeal'],
  WITHDRAWN: ['Close Appeal'],
}

const fallbackPrimaryAppealActions = [
  'Submit Appeal',
  'Final Packet',
  'Generate Packet',
  'Add Evidence',
]

function getAppealStatus(item: Appeal) {
  return item.appealStatus?.trim().toUpperCase() ?? ''
}

function isMoreInfoRequired(item: Appeal) {
  return getAppealStatus(item) === 'MORE_INFO_REQUIRED'
}

function hasFinalPacket(item: Appeal) {
  return Boolean(item.finalPacketGeneratedAt || item.finalPacketFileReference || item.finalPacketFileName)
}

function hasEvidence(item: Appeal) {
  if (item.supportingDocuments?.length) {
    return true
  }

  return Boolean(
    item.supportingDocumentsMetadata?.some((document) =>
      String(document.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
    ),
  )
}

function getActionLabel<TItem>(action: CrudTableAction<TItem>, item: TItem) {
  return typeof action.label === 'function' ? action.label(item) : action.label
}

function getAppealActionLabels(item: Appeal) {
  const status = getAppealStatus(item)

  if ((status === 'PACKET_GENERATED' || status === 'READY') && hasFinalPacket(item)) {
    return ['Submit Appeal']
  }

  if (status === 'PACKET_GENERATED' || status === 'READY') {
    return hasEvidence(item) ? ['Final Packet'] : ['Add Evidence', 'Final Packet']
  }

  return primaryAppealActionOrder[status] ?? fallbackPrimaryAppealActions
}

function getVisibleAppealActions(item: Appeal, actions: AppealWorkflowAction[]) {
  const orderedLabels = getAppealActionLabels(item)

  return orderedLabels
    .map((label) => actions.find((action) => getActionLabel(action, item) === label))
    .filter((action): action is AppealWorkflowAction => Boolean(action))
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.includes(',') ? result.split(',').pop() ?? '' : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read selected file.'))
    reader.readAsDataURL(file)
  })
}

export function AppealsPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const returnTo = `${location.pathname}${location.search}`
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const arWorkItemsQuery = useGetArWorkItemsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const [generatePacket] = useGenerateAppealPacketMutation()
  const [generateFinalPacket] = useGenerateFinalAppealPacketMutation()
  const [addAppealDocument] = useAddAppealDocumentMutation()
  const [submitAppealEvidence] = useSubmitAppealEvidenceMutation()
  const [submitAppeal] = useSubmitAppealMutation()
  const [recordPayerReceived] = useRecordAppealPayerReceivedMutation()
  const [changeAppealStatus] = useChangeAppealStatusMutation()
  const [requestMoreInfo] = useRequestAppealMoreInfoMutation()
  const [recordOutcome] = useRecordAppealOutcomeMutation()
  const [closeAppeal] = useCloseAppealMutation()
  const [reasonAction, setReasonAction] = useState<{
    item: Appeal
    action: 'OUTCOME' | 'CLOSE' | 'MORE_INFO'
    title: string
  } | null>(null)
  const [reason, setReason] = useState('')
  const [outcomeValue, setOutcomeValue] = useState<AppealOutcome>('OVERTURNED')
  const [evidenceDialog, setEvidenceDialog] = useState<{ item: Appeal } | null>(null)
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceType, setEvidenceType] = useState('MEDICAL_RECORDS')
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [evidenceReason, setEvidenceReason] = useState('Supporting evidence added for appeal packet readiness.')
  const [finalPacketDialog, setFinalPacketDialog] = useState<{ item: Appeal } | null>(null)
  const [finalPacketChannel, setFinalPacketChannel] = useState('PORTAL')
  const [finalPacketReason, setFinalPacketReason] = useState('Final appeal packet generated from work queue.')
  const [dialogSubmitting, setDialogSubmitting] = useState(false)

  async function runAppealAction(action: () => Promise<unknown>, summary: string) {
    try {
      await action()
      showToast({ severity: 'success', summary })
    } catch (error) {
      showToast({ severity: 'error', summary: 'Appeal action failed', detail: getApiErrorMessage(error) })
    }
  }

  function openEvidenceDialog(item: Appeal) {
    setEvidenceDialog({ item })
    setEvidenceFile(null)
    setEvidenceType('MEDICAL_RECORDS')
    setEvidenceNotes('')
    setEvidenceReason('Supporting evidence added for appeal packet readiness.')
  }

  function openFinalPacketDialog(item: Appeal) {
    setFinalPacketDialog({ item })
    setFinalPacketChannel(item.submissionChannel ?? item.submissionMethod ?? 'PORTAL')
    setFinalPacketReason('Final appeal packet generated from work queue.')
  }

  async function submitEvidenceDialog() {
    if (!evidenceDialog || !evidenceFile) return
    setDialogSubmitting(true)
    try {
      const contentBase64 = await readFileAsBase64(evidenceFile)
      const reasonText = evidenceReason.trim() || 'Supporting evidence added for appeal packet readiness.'
      await addAppealDocument({
        id: evidenceDialog.item._id,
        documentType: evidenceType,
        fileName: evidenceFile.name,
        fileSize: evidenceFile.size,
        mimeType: evidenceFile.type,
        contentBase64,
        notes: evidenceNotes.trim() || undefined,
        reason: reasonText,
      }).unwrap()

      if (isMoreInfoRequired(evidenceDialog.item)) {
        await submitAppealEvidence({
          id: evidenceDialog.item._id,
          reason: reasonText,
        }).unwrap()
        showToast({ severity: 'success', summary: 'Appeal evidence submitted' })
      } else {
        showToast({ severity: 'success', summary: 'Appeal evidence uploaded' })
      }

      setEvidenceDialog(null)
      setEvidenceFile(null)
    } catch (error) {
      showToast({ severity: 'error', summary: 'Evidence upload failed', detail: getApiErrorMessage(error) })
    } finally {
      setDialogSubmitting(false)
    }
  }

  async function submitFinalPacketDialog() {
    if (!finalPacketDialog || !finalPacketReason.trim()) return
    setDialogSubmitting(true)
    try {
      await generateFinalPacket({
        id: finalPacketDialog.item._id,
        reason: finalPacketReason.trim(),
        submissionMethod: finalPacketChannel,
        submissionChannel: finalPacketChannel,
      }).unwrap()
      showToast({ severity: 'success', summary: 'Final appeal packet generated' })
      setFinalPacketDialog(null)
    } catch (error) {
      showToast({ severity: 'error', summary: 'Final packet failed', detail: getApiErrorMessage(error) })
    } finally {
      setDialogSubmitting(false)
    }
  }

  const claimsOptions = useMemo(
    () =>
      (claimsQuery.data?.data ?? []).map((item) => ({
        label: [item.claimDate, item.claimStatus, item.batchId].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [claimsQuery.data],
  )
  const arWorkItemsOptions = useMemo(
    () =>
      (arWorkItemsQuery.data?.data ?? []).map((item) => ({
        label: [item.agingBucket, item.status, item.priority].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [arWorkItemsQuery.data],
  )
  const payersOptions = useMemo(
    () =>
      (payersQuery.data?.data ?? []).map((item) => ({
        label: item.payerName ? `${item.payerName} (${item.payerId ?? item._id})` : item.payerId ?? item._id,
        value: item.payerId ?? item._id,
      })),
    [payersQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      claims: claimsOptions,
      arWorkItems: arWorkItemsOptions,
      payers: payersOptions,
    }),
    [claimsOptions, arWorkItemsOptions, payersOptions],
  )

  function createOpenClaimAction(item: Appeal): CrudTableAction<Appeal> {
    return {
      label: 'Open Claim',
      icon: <Navigation className="h-4 w-4" />,
      disabled: !item.claimId,
      onClick: () => navigate(`/rcm/claims${buildWorkflowSearch(
        mergeWorkflowContext(workflowContext, {
          claimId: item.claimId,
          appealId: item._id,
          denialId: item.denialId,
          returnTo,
          returnLabel: 'Back to Appeals',
        }),
      )}`),
    }
  }

  function createAppealWorkflowActions(item: Appeal): AppealWorkflowAction[] {
    return [
      {
        label: 'Add Evidence',
        icon: <FilePlus2 className="h-4 w-4" />,
        disabled: ['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD', 'CLOSED'].includes(item.appealStatus ?? ''),
        onClick: () => openEvidenceDialog(item),
      },
      {
        label: 'Generate Packet',
        icon: <FileStack className="h-4 w-4" />,
        disabled: ['SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED', 'OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD', 'CLOSED'].includes(item.appealStatus ?? ''),
        onClick: () => void runAppealAction(
          () => generatePacket({ id: item._id, reason: 'Generated from appeal work queue.' }).unwrap(),
          'Appeal packet generated',
        ),
      },
      {
        label: 'Final Packet',
        icon: <FileCheck2 className="h-4 w-4" />,
        disabled: hasFinalPacket(item),
        onClick: () => openFinalPacketDialog(item),
      },
      {
        label: 'Submit Appeal',
        icon: <Send className="h-4 w-4" />,
        disabled: !hasFinalPacket(item),
        onClick: () => void runAppealAction(
          () => submitAppeal({ id: item._id, reason: 'Submitted from appeal work queue.', submissionMethod: item.submissionMethod ?? 'PORTAL' }).unwrap(),
          'Appeal submitted',
        ),
      },
      {
        label: 'Payer Received',
        icon: <Clock3 className="h-4 w-4" />,
        disabled: !['SUBMITTED'].includes(item.appealStatus ?? ''),
        onClick: () => void runAppealAction(
          () => recordPayerReceived({ id: item._id, reason: 'Payer receipt recorded.' }).unwrap(),
          'Payer receipt recorded',
        ),
      },
      {
        label: 'Payer Review',
        icon: <Gavel className="h-4 w-4" />,
        disabled: !['PAYER_RECEIVED'].includes(item.appealStatus ?? ''),
        onClick: () => void runAppealAction(
          () => changeAppealStatus({
            id: item._id,
            appealStatus: 'PAYER_REVIEW',
            reason: 'Payer moved appeal into review.',
            payerResponse: 'Appeal is under payer review.',
          }).unwrap(),
          'Appeal moved to payer review',
        ),
      },
      {
        label: 'More Info',
        icon: <MessageSquareMore className="h-4 w-4" />,
        disabled: !['SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW'].includes(item.appealStatus ?? ''),
        onClick: () => {
          setReasonAction({ item, action: 'MORE_INFO', title: 'Request more information' })
          setReason('')
        },
      },
      {
        label: 'Record Outcome',
        icon: <CheckCircle2 className="h-4 w-4" />,
        disabled: !['PAYER_REVIEW', 'IN_REVIEW', 'EVIDENCE_SUBMITTED'].includes(item.appealStatus ?? ''),
        onClick: () => {
          setReasonAction({ item, action: 'OUTCOME', title: 'Record appeal outcome' })
          setOutcomeValue('OVERTURNED')
          setReason('')
        },
      },
      {
        label: 'Close Appeal',
        icon: <Lock className="h-4 w-4" />,
        disabled: !['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD', 'WITHDRAWN'].includes(item.appealStatus ?? ''),
        onClick: () => {
          setReasonAction({ item, action: 'CLOSE', title: 'Close appeal' })
          setReason('')
        },
      },
    ]
  }

  const crudConfig: CrudPageConfig<
    Appeal,
    AppealFormValues,
    AppealCreatePayload,
    AppealUpdatePayload
  > = useMemo(
    () => ({
      title: 'Appeals',
      resourceName: 'Appeal',
      help: {
        title: 'Appeals',
        intro: 'Manage the complete lifecycle of a claim appeal from document compilation to final resolution and tracking.',
        steps: [
          {
            label: 'Add Evidence',
            icon: <FilePlus2 className="h-4 w-4" aria-hidden="true" />,
            description: 'Upload supporting documentation such as medical records or provider letters to strengthen the appeal case.',
          },
          {
            label: 'Generate Packet',
            icon: <FileStack className="h-4 w-4" aria-hidden="true" />,
            description: 'Compile all evidence, letters, and claim details into a structured appeal packet.',
          },
          {
            label: 'Final Packet',
            icon: <FileCheck2 className="h-4 w-4" aria-hidden="true" />,
            description: 'Select the submission channel and generate the final packet. Backend readiness validation runs here.',
          },
          {
            label: 'Submit Appeal',
            icon: <Send className="h-4 w-4" aria-hidden="true" />,
            description: 'Send the finalized appeal packet to the payer via their preferred channel.',
          },
          {
            label: 'Payer Received',
            icon: <Clock3 className="h-4 w-4" aria-hidden="true" />,
            description: 'Mark the appeal as received once acknowledged by the payer.',
          },
          {
            label: 'Payer Review',
            icon: <Gavel className="h-4 w-4" aria-hidden="true" />,
            description: 'Track the status as the payer moves the appeal into official review.',
          },
          {
            label: 'Record Outcome',
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
            description: 'Record the payer decision as overturned, partially overturned, or upheld.',
          },
          {
            label: 'Close Appeal',
            icon: <Lock className="h-4 w-4" aria-hidden="true" />,
            description: 'Close the appeal after the payer outcome is recorded.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Appeal',
      createDialogTitle: 'Add appeal',
      editDialogTitle: 'Edit appeal',
      viewDialogTitle: 'Appeal details',
      deleteDialogTitle: 'Delete appeal?',
      emptyMessage: 'No appeals found.',
      exportFileName: 'appeals',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('appeal', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'appeals',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderAppealGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createAppealTableColumns(referenceOptions),
      },
      form: createAppealFormConfig(referenceOptions),
      api: {
        useListQuery: useGetAppealsQuery,
      },
      mapItemToFormValues: mapAppealToFormValues,
      mapFormValuesToCreatePayload: mapAppealFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapAppealFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="appeal" context={workflowContext} />
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const workflowActions = createAppealWorkflowActions(item)
          const visibleWorkflowActions = getVisibleAppealActions(item, workflowActions)
          const compactActions: Array<CrudTableAction<Appeal>> = [
            createOpenClaimAction(item),
            ...visibleWorkflowActions,
            ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
          ]

          return compactActions
        },
        viewContent: (item) => (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="appeal"
              claimLabel={item.claimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                denialId: item.denialId,
                appealId: item._id,
                arWorkItemId: item.arWorkItemId,
                returnTo,
                returnLabel: 'Back to Appeals',
              })}
              statuses={{
                denial: item.denialId ? 'APPEAL_READY' : undefined,
                appeal: item.appealStatus,
                arWorkItem: item.arWorkItemId ? 'OPEN' : undefined,
                paymentPosting: ['OVERTURNED', 'PARTIALLY_OVERTURNED', 'CLOSED'].includes(item.appealStatus ?? '') ? 'POSTED' : undefined,
              }}
              nextAction={
                item.appealStatus === 'OVERTURNED' || item.appealStatus === 'PARTIALLY_OVERTURNED'
                  ? 'Import reprocessed ERA and validate denial recovery payment.'
                  : item.appealStatus === 'UPHELD'
                    ? 'Close or write off the denial according to policy.'
                    : 'Complete packet, submit appeal, and track payer response.'
              }
            />
            {renderAppealDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderAppealGridItem(item, referenceOptions),
      },
    }),
    [changeAppealStatus, closeAppeal, generatePacket, navigate, recordPayerReceived, referenceOptions, requestMoreInfo, returnTo, submitAppeal, workflowContext],
  )

  async function submitReasonAction() {
    if (!reasonAction || !reason.trim()) return
    const note = reason.trim()
    if (reasonAction.action === 'CLOSE') {
      await runAppealAction(
        () => closeAppeal({
          id: reasonAction.item._id,
          reason: note,
          notes: note,
          outcomeCategory: reasonAction.item.outcome ?? reasonAction.item.resolution ?? reasonAction.item.appealStatus ?? 'CLOSED',
        }).unwrap(),
        'Appeal closed',
      )
    } else if (reasonAction.action === 'MORE_INFO') {
      await runAppealAction(
        () => requestMoreInfo({
          id: reasonAction.item._id,
          reason: note,
          payerResponse: note,
        }).unwrap(),
        'More information requested',
      )
    } else if (reasonAction.action === 'OUTCOME') {
      const outcome = outcomeValue
      await runAppealAction(
        () => recordOutcome({ id: reasonAction.item._id, outcome, decisionNotes: note }).unwrap(),
        outcome === 'OVERTURNED'
          ? 'Appeal overturned'
          : outcome === 'PARTIALLY_OVERTURNED'
            ? 'Appeal partially overturned'
            : 'Appeal upheld',
      )
    }
    setReasonAction(null)
    setReason('')
    setOutcomeValue('OVERTURNED')
  }

  return (
    <>
      <CrudPage key={workflowKey || 'appeals'} config={crudConfig} />
      <ActionReasonDialog
        open={Boolean(evidenceDialog)}
        title="Upload appeal evidence"
        message="Attach supporting documentation and record why it is being added to this appeal."
        reason={evidenceReason}
        reasonLabel="Reason"
        reasonPlaceholder="Enter why this evidence is being added."
        confirmLabel="Upload Evidence"
        loading={dialogSubmitting}
        confirmDisabled={!evidenceFile}
        onReasonChange={setEvidenceReason}
        onConfirm={() => void submitEvidenceDialog()}
        onClose={() => {
          if (!dialogSubmitting) setEvidenceDialog(null)
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-strong)]" htmlFor="appeal-evidence-type">Document type</label>
            <Dropdown
              inputId="appeal-evidence-type"
              value={evidenceType}
              options={appealDocumentTypeOptions}
              onChange={(event) => setEvidenceType(String(event.value))}
              className="w-full"
              disabled={dialogSubmitting}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-strong)]" htmlFor="appeal-evidence-file">Evidence file</label>
            <input
              id="appeal-evidence-file"
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg"
              className="block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              disabled={dialogSubmitting}
              onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-strong)]" htmlFor="appeal-evidence-notes">Notes</label>
            <InputTextarea
              id="appeal-evidence-notes"
              value={evidenceNotes}
              onChange={(event) => setEvidenceNotes(event.target.value)}
              rows={3}
              className="w-full"
              disabled={dialogSubmitting}
            />
          </div>
        </div>
      </ActionReasonDialog>

      <ActionReasonDialog
        open={Boolean(finalPacketDialog)}
        title="Generate final packet"
        message="Select the payer submission channel and record why the final packet is being generated."
        reason={finalPacketReason}
        reasonPlaceholder="Enter final packet generation reason."
        confirmLabel="Generate Final Packet"
        loading={dialogSubmitting}
        confirmDisabled={!finalPacketChannel}
        onReasonChange={setFinalPacketReason}
        onConfirm={() => void submitFinalPacketDialog()}
        onClose={() => {
          if (!dialogSubmitting) setFinalPacketDialog(null)
        }}
      >
        <label className="mb-2 block text-sm font-medium text-[var(--color-text-strong)]" htmlFor="appeal-final-channel">Submission channel</label>
        <Dropdown
          inputId="appeal-final-channel"
          value={finalPacketChannel}
          options={appealChannelOptions}
          onChange={(event) => setFinalPacketChannel(String(event.value))}
          className="w-full"
          disabled={dialogSubmitting}
        />
      </ActionReasonDialog>

      <ActionReasonDialog
        open={Boolean(reasonAction)}
        title={reasonAction?.title ?? 'Appeal action'}
        message="Record the reason for this appeal workflow action."
        reason={reason}
        reasonPlaceholder="Enter appeal action reason."
        confirmLabel={reasonAction?.action === 'CLOSE' ? 'Close Appeal' : reasonAction?.action === 'MORE_INFO' ? 'Request More Info' : 'Record Outcome'}
        tone={(reasonAction?.action === 'OUTCOME' && outcomeValue === 'UPHELD') ? 'danger' : 'default'}
        onReasonChange={setReason}
        onClose={() => {
          setReasonAction(null)
          setReason('')
          setOutcomeValue('OVERTURNED')
        }}
        onConfirm={() => void submitReasonAction()}
      >
        {reasonAction?.action === 'OUTCOME' ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-strong)]" htmlFor="appeal-outcome">Outcome</label>
            <Dropdown
              inputId="appeal-outcome"
              value={outcomeValue}
              options={appealOutcomeOptions}
              onChange={(event) => setOutcomeValue(event.value as AppealOutcome)}
              className="w-full"
            />
          </div>
        ) : null}
      </ActionReasonDialog>
    </>
  )
}
