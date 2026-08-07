import { useState } from 'react'
import { Dialog } from 'primereact/dialog'

interface PromptTopicCellProps {
  value?: string | string[] | null
  title?: string
  variant?: 'prompt' | 'audience'
}

const variantStyles = {
  prompt: {
    card: 'border-indigo-200/80 bg-indigo-50/70',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  audience: {
    card: 'border-teal-200/80 bg-teal-50/70',
    badge: 'bg-teal-100 text-teal-700',
  },
} as const

export function PromptTopicCell({
  value,
  title = 'Prompt/Topic',
  variant = 'prompt',
}: PromptTopicCellProps) {
  const [visible, setVisible] = useState(false)
  const values = (Array.isArray(value) ? value : value ? [value] : [])
    .map(item => item.trim())
    .filter(Boolean)
  const preview = values.join(' · ')
  const styles = variantStyles[variant]

  if (!preview) return <span className="text-xs text-[var(--color-text-muted)]">-</span>

  return (
    <div className="w-[18rem] max-w-[18rem] min-w-0">
      <p className="line-clamp-2 break-words text-xs leading-5 text-[var(--color-text)]">
        {preview}
      </p>
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)] hover:underline"
        aria-label={`View all ${title.toLowerCase()}`}
      >
        View full
      </button>
      <Dialog
        visible={visible}
        onHide={() => setVisible(false)}
        header={`${title} (${values.length})`}
        style={{ width: '700px', maxWidth: '95vw' }}
        pt={{
          root: { className: 'rounded-2xl border-none shadow-2xl overflow-hidden' },
          header: { className: 'border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 text-[var(--color-text-strong)]' },
          content: { className: 'bg-[var(--color-surface)] p-6' },
        }}
      >
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {values.map((item, index) => (
            <div
              key={`${index}-${item}`}
              className={`flex items-start gap-3 rounded-xl border p-4 ${styles.card}`}
            >
              <span className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${styles.badge}`}>
                {index + 1}
              </span>
              <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text-strong)]">
                {item}
              </p>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  )
}
