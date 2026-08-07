import { AlertTriangle } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from 'primereact/inputtextarea'
import type { ReactNode } from 'react'

interface ActionReasonDialogProps {
  open: boolean
  title: string
  message?: string
  reason: string
  reasonLabel?: string
  reasonPlaceholder?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  loading?: boolean
  required?: boolean
  confirmDisabled?: boolean
  children?: ReactNode
  onReasonChange: (reason: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function ActionReasonDialog({
  open,
  title,
  message,
  reason,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Enter reason',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  required = true,
  confirmDisabled = false,
  children,
  onReasonChange,
  onConfirm,
  onClose,
}: ActionReasonDialogProps) {
  const isConfirmDisabled = loading || confirmDisabled || (required && !reason.trim())

  return (
    <Dialog
      visible={open}
      onHide={onClose}
      modal
      blockScroll
      dismissableMask={!loading}
      draggable={false}
      resizable={false}
      showHeader={false}
      className="w-[min(92vw,34rem)]"
      contentClassName="overflow-hidden rounded-lg p-0"
    >
      <div className="bg-[var(--color-surface)]">
        <div className="px-6 pt-6">
          <div className="flex items-start gap-3">
            <div className={tone === 'danger' ? 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600' : 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}>
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{title}</h2>
              {message ? <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{message}</p> : null}
            </div>
          </div>

          {children ? <div className="mt-5">{children}</div> : null}

          <label className={children ? 'mt-4 block text-sm font-medium text-[var(--color-text-strong)]' : 'mt-5 block text-sm font-medium text-[var(--color-text-strong)]'} htmlFor="action-reason-dialog-reason">
            {reasonLabel}
          </label>
          <InputTextarea
            id="action-reason-dialog-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            autoFocus
            className="mt-2 w-full"
            placeholder={reasonPlaceholder}
            disabled={loading}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            label={cancelLabel}
            severity="secondary"
            outlined
            disabled={loading}
            onClick={onClose}
          />
          <Button
            type="button"
            label={confirmLabel}
            severity={tone === 'danger' ? 'danger' : undefined}
            loading={loading}
            disabled={isConfirmDisabled}
            onClick={onConfirm}
          />
        </div>
      </div>
    </Dialog>
  )
}
