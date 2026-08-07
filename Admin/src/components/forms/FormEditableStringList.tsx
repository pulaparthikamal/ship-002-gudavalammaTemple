import { useRef } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/utils/classNames'

interface FormEditableStringListProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  disabled?: boolean
  containerClassName?: string
  variant?: 'prompt' | 'audience'
  itemLabel?: string
  addLabel?: string
  emptyMessage?: string
  maxItems?: number
  maxLength?: number
  rows?: number
}

const variantStyles = {
  prompt: {
    card: 'border-indigo-200/80 bg-indigo-50/70',
    badge: 'bg-indigo-100 text-indigo-700',
    button: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  },
  audience: {
    card: 'border-teal-200/80 bg-teal-50/70',
    badge: 'bg-teal-100 text-teal-700',
    button: 'border-teal-200 text-teal-700 hover:bg-teal-50',
  },
} as const

export function FormEditableStringList<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  disabled = false,
  containerClassName,
  variant = 'prompt',
  itemLabel = 'Item',
  addLabel = 'Add item',
  emptyMessage = 'No items added yet.',
  maxItems = 50,
  maxLength = 5000,
  rows = 3,
}: FormEditableStringListProps<TFieldValues>) {
  const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const styles = variantStyles[variant]

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue: unknown = field.value
        const values: string[] = Array.isArray(rawValue)
          ? rawValue.map((value: unknown) => typeof value === 'string' ? value : String(value ?? ''))
          : []

        const updateItem = (index: number, value: string) => {
          const nextValues = [...values]
          nextValues[index] = value.slice(0, maxLength)
          field.onChange(nextValues)
        }

        const addItem = () => {
          if (disabled || values.length >= maxItems) return
          const nextIndex = values.length
          field.onChange([...values, ''])
          window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus())
        }

        const removeItem = (index: number) => {
          if (disabled) return
          field.onChange(values.filter((_, itemIndex) => itemIndex !== index))
          field.onBlur()
        }

        return (
          <div className={cn('flex min-w-0 flex-col gap-3', containerClassName)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]">
                  {label}
                </label>
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">{values.length} item{values.length === 1 ? '' : 's'}</span>
              </div>
              <button
                type="button"
                onClick={addItem}
                disabled={disabled || values.length >= maxItems}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  styles.button,
                )}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {addLabel}
              </button>
            </div>

            {values.length ? (
              <div className="space-y-3">
                {values.map((value, index) => {
                  const normalizedValue = value.trim().toLowerCase()
                  const isDuplicate = Boolean(normalizedValue) && values.some(
                    (candidate, candidateIndex) => candidateIndex !== index && candidate.trim().toLowerCase() === normalizedValue,
                  )
                  const itemError = !value.trim()
                    ? `${itemLabel} cannot be empty.`
                    : isDuplicate
                      ? `This ${itemLabel.toLowerCase()} is already in the list.`
                      : undefined

                  return (
                    <div key={index} className={cn('rounded-xl border p-4', styles.card)}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold', styles.badge)}>
                            {index + 1}
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-text-strong)]">{itemLabel} {index + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={disabled}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <textarea
                        ref={element => { inputRefs.current[index] = element }}
                        value={value}
                        onChange={event => updateItem(index, event.target.value)}
                        onBlur={() => {
                          updateItem(index, value.trim())
                          field.onBlur()
                        }}
                        rows={rows}
                        maxLength={maxLength}
                        disabled={disabled}
                        placeholder={`Enter ${itemLabel.toLowerCase()}`}
                        className={cn(
                          'w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm leading-6 text-[var(--color-text-strong)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]',
                          itemError ? 'border-red-300' : 'border-[var(--color-border)]',
                        )}
                        aria-invalid={Boolean(itemError)}
                      />
                      <div className="mt-1.5 flex min-h-5 items-start justify-between gap-3 px-0.5 text-xs">
                        <span className={itemError ? 'font-medium text-red-600' : 'text-[var(--color-text-muted)]'}>
                          {itemError || ''}
                        </span>
                        <span className="shrink-0 text-[var(--color-text-muted)]">{value.length}/{maxLength}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                {emptyMessage}
              </div>
            )}

            <div className="min-h-5 px-0.5 text-xs">
              <span className={fieldState.error ? 'font-medium text-red-600' : 'text-[var(--color-text-muted)]'}>
                {fieldState.error?.message || helperText}
              </span>
            </div>
          </div>
        )
      }}
    />
  )
}
