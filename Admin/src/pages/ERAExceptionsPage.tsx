import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Navigation, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from 'primereact/inputtextarea'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createEraExceptionFormConfig, createEraExceptionTableColumns, mapEraExceptionFormToPayload, mapEraExceptionToFormValues, renderEraExceptionDetails, renderEraExceptionGridItem } from '@/models/eraExceptionModel'
import { useEraExceptionActionMutation, useExplainEraExceptionWithAiMutation, useGetEraExceptionsQuery } from '@/services/api/endpoints/eraExceptionsApi'
import type { EraException, EraExceptionCreatePayload, EraExceptionFormValues, EraExceptionUpdatePayload } from '@/types/eraException'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

type ReasonAction = {
  item: EraException
  action: 'resolve' | 'reprocess' | 'escalate' | 'ignore'
  title: string
  reasonLabel: string
  submitLabel: string
  severity?: 'danger' | 'warning'
}

export function ERAExceptionsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [runAction, actionState] = useEraExceptionActionMutation()
  const [explainWithAi, explainWithAiState] = useExplainEraExceptionWithAiMutation()
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null)
  const [reason, setReason] = useState('')

  async function handleAction(item: EraException, action: string, data: Record<string, unknown> = {}) {
    try {
      await runAction({ id: item._id, action, data }).unwrap()
      showToast({ severity: 'success', summary: 'ERA exception updated' })
      return true
    } catch (error) {
      showToast({ severity: 'error', summary: 'ERA exception action failed', detail: getApiErrorMessage(error) })
      return false
    }
  }

  function openReasonAction(action: ReasonAction) {
    setReasonAction(action)
    setReason('')
  }

  function closeReasonAction() {
    if (actionState.isLoading) return
    setReasonAction(null)
    setReason('')
  }

  async function submitReasonAction() {
    if (!reasonAction || !reason.trim()) return
    const succeeded = await handleAction(reasonAction.item, reasonAction.action, { reason: reason.trim() })
    if (succeeded) {
      setReasonAction(null)
      setReason('')
    }
  }

  const crudConfig: CrudPageConfig<
    EraException,
    EraExceptionFormValues,
    EraExceptionCreatePayload,
    EraExceptionUpdatePayload
  > = useMemo(
    () => ({
      title: 'ERA Exceptions',
      resourceName: 'ERA Exception',
      showCreateButton: false,
      createButtonLabel: 'Add ERA Exception',
      createDialogTitle: 'Add ERA exception',
      editDialogTitle: 'Edit ERA exception',
      viewDialogTitle: 'ERA exception details',
      deleteDialogTitle: 'Delete ERA exception?',
      emptyMessage: 'No ERA exceptions found.',
      exportFileName: 'era-exceptions',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: { module: 'era-exceptions' },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderEraExceptionGridItem(item),
      table: { columns: createEraExceptionTableColumns() },
      form: createEraExceptionFormConfig(),
      api: {
        useListQuery: useGetEraExceptionsQuery,
      },
      mapItemToFormValues: mapEraExceptionToFormValues,
      mapFormValuesToCreatePayload: mapEraExceptionFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapEraExceptionFormToPayload(values),
      deleteDialogMessage: (item) => `This will delete ${item.exceptionType}. Production environments require resolve or ignore instead.`,
      slots: {
        rowActions: (item, defaultActions) => [
          ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
          {
            label: 'Resolve',
            icon: <CheckCircle2 className="h-4 w-4" />,
            disabled: ['RESOLVED', 'IGNORED'].includes(item.status ?? '') || actionState.isLoading,
            onClick: () => openReasonAction({
              item,
              action: 'resolve',
              title: 'Resolve ERA exception',
              reasonLabel: 'Resolution notes',
              submitLabel: 'Resolve',
            }),
          },
          {
            label: 'AI Explain',
            icon: <Sparkles className="h-4 w-4" />,
            disabled: ['RESOLVED', 'IGNORED'].includes(item.status ?? '') || explainWithAiState.isLoading,
            onClick: async () => {
              try {
                await explainWithAi(item._id).unwrap()
                showToast({ severity: 'success', summary: 'AI ERA explanation completed' })
              } catch (error) {
                showToast({ severity: 'error', summary: 'AI explanation failed', detail: getApiErrorMessage(error) })
              }
            },
          },
          {
            label: 'Reprocess',
            icon: <RefreshCw className="h-4 w-4" />,
            disabled: item.status === 'RESOLVED' || actionState.isLoading,
            onClick: () => openReasonAction({
              item,
              action: 'reprocess',
              title: 'Reprocess ERA exception',
              reasonLabel: 'Reprocess reason',
              submitLabel: 'Reprocess',
            }),
          },
          {
            label: 'Create AR',
            icon: <FileText className="h-4 w-4" />,
            disabled: Boolean(item.relatedARWorkItem) || actionState.isLoading,
            onClick: () => void handleAction(item, 'create_ar'),
          },
          {
            label: 'Escalate',
            icon: <AlertTriangle className="h-4 w-4" />,
            disabled: item.status === 'RESOLVED' || actionState.isLoading,
            onClick: () => openReasonAction({
              item,
              action: 'escalate',
              title: 'Escalate ERA exception',
              reasonLabel: 'Escalation reason',
              submitLabel: 'Escalate',
              severity: 'warning',
            }),
          },
          {
            label: 'Ignore',
            icon: <ShieldAlert className="h-4 w-4" />,
            tone: 'danger',
            disabled: ['RESOLVED', 'IGNORED'].includes(item.status ?? '') || actionState.isLoading,
            onClick: () => openReasonAction({
              item,
              action: 'ignore',
              title: 'Ignore ERA exception',
              reasonLabel: 'Reason for ignoring this exception',
              submitLabel: 'Ignore',
              severity: 'danger',
            }),
          },
          {
            label: 'Open Claim',
            icon: <Navigation className="h-4 w-4" />,
            disabled: !item.relatedClaim,
            onClick: () => navigate(`/rcm/claims?claimId=${item.relatedClaim}`),
          },
        ],
        viewContent: (item) => renderEraExceptionDetails(item),
        gridItem: (item) => renderEraExceptionGridItem(item),
      },
    }),
    [actionState.isLoading, explainWithAi, explainWithAiState.isLoading, navigate, runAction, showToast],
  )

  return (
    <>
      <CrudPage config={crudConfig} />
      <Dialog
        header={reasonAction?.title}
        visible={Boolean(reasonAction)}
        onHide={closeReasonAction}
        style={{ width: 'min(560px, 96vw)' }}
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="crud-view-dialog"
        maskClassName="crud-form-dialog-mask"
      >
        <div className="space-y-4 text-[var(--color-text)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            {reasonAction?.item.exceptionType}
          </p>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]">
              {reasonAction?.reasonLabel}
            </span>
            <InputTextarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="w-full"
              placeholder="Required"
              autoResize={false}
              autoFocus
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              label="Cancel"
              severity="secondary"
              outlined
              disabled={actionState.isLoading}
              onClick={closeReasonAction}
            />
            <Button
              type="button"
              label={reasonAction?.submitLabel ?? 'Confirm'}
              severity={reasonAction?.severity}
              loading={actionState.isLoading}
              disabled={!reason.trim()}
              onClick={() => void submitReasonAction()}
            />
          </div>
        </div>
      </Dialog>
    </>
  )
}
