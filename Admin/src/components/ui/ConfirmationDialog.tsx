import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { cn } from '@/utils/classNames'

type ConfirmationTone = 'default' | 'danger'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmationTone
  icon?: ReactNode
  confirmLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

const toneClasses: Record<ConfirmationTone, { icon: string; iconBg: string }> = {
  default: {
    icon: 'text-[var(--color-primary)]',
    iconBg: 'bg-[var(--color-primary-soft)]',
  },
  danger: {
    icon: 'text-red-600',
    iconBg: 'bg-red-50',
  },
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  icon,
  confirmLoading = false,
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  const styles = toneClasses[tone]

  return (
    <Dialog
      visible={open}
      onHide={onClose}
      modal
      blockScroll
      dismissableMask
      draggable={false}
      resizable={false}
      showHeader={false}
      className="w-[min(92vw,26rem)]"
      contentClassName="overflow-hidden rounded-lg p-0"
    >
      <div className="bg-[var(--color-surface)]">
        <div className="px-6 pt-6 text-center">
          <div
            className={cn(
              'mx-auto grid h-14 w-14 place-items-center rounded-lg',
              styles.iconBg,
              styles.icon,
            )}
          >
            {icon ?? <AlertTriangle className="h-7 w-7" aria-hidden="true" />}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[var(--color-text-strong)]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{message}</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            label={cancelLabel}
            severity="secondary"
            outlined
            disabled={confirmLoading}
            onClick={onClose}
          />
          <Button
            type="button"
            label={confirmLabel}
            severity={tone === 'danger' ? 'danger' : undefined}
            loading={confirmLoading}
            onClick={onConfirm}
          />
        </div>
      </div>
    </Dialog>
  )
}
