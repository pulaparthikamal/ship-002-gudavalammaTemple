import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'

export interface ScreenHelpStep {
  label: string
  description: string
  icon?: ReactNode
}

export interface ScreenHelpContent {
  title: string
  intro?: string
  steps: ScreenHelpStep[]
}

interface ScreenHelpButtonProps {
  help: ScreenHelpContent
  children?: ReactNode
}

export function ScreenHelpButton({ help, children }: ScreenHelpButtonProps) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <Button
        type="button"
        icon={<Info className="h-4 w-4" aria-hidden="true" />}
        rounded
        text
        severity="secondary"
        aria-label={`Open ${help.title} help`}
        tooltip={`What to do in ${help.title}`}
        tooltipOptions={{ position: 'top', className: 'screen-help-tooltip' }}
        className="h-8 w-8 shrink-0 p-0"
        onClick={() => setVisible(true)}
      />

      <Dialog
        visible={visible}
        header={`${help.title} workflow`}
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="screen-help-dialog"
        style={{ width: 'min(92vw, 42rem)' }}
        onHide={() => setVisible(false)}
      >
        <div className="space-y-3">
          {help.intro ? (
            <p className="text-sm leading-6 text-[var(--color-text-muted)]">{help.intro}</p>
          ) : null}
          {children}
          <ol className="space-y-3">
            {help.steps.map((step, index) => (
              <li
                key={`${step.label}-${index}`}
                className="grid grid-cols-[2rem_1fr] gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                  {step.icon ?? <Info className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--color-text-strong)]">
                    {index + 1}. {step.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--color-text-muted)]">
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Dialog>
    </>
  )
}
