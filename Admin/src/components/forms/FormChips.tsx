import { useState } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { cn } from '@/utils/classNames'

export interface ChipOption {
  label: string
  value: string
  category?: string
}

interface FormChipsProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  options: ChipOption[]
  helperText?: string
  containerClassName?: string
  placeholder?: string
}

export function FormChips<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  helperText,
  containerClassName,
  placeholder = 'Select interests',
}: FormChipsProps<TFieldValues>) {
  const [visible, setVisible] = useState(false)
  const inputId = name.replaceAll('.', '-')

  // Group options by category
  const categories = options.reduce((acc, opt) => {
    const cat = opt.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(opt)
    return acc
  }, {} as Record<string, ChipOption[]>)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value as any
        let selectedValues: string[] = []

        if (Array.isArray(rawValue)) {
          selectedValues = rawValue
        } else if (typeof rawValue === 'string' && rawValue.length > 0) {
          selectedValues = rawValue
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        }

        const toggleValue = (val: string) => {
          const newValues = selectedValues.includes(val)
            ? selectedValues.filter((v) => v !== val)
            : [...selectedValues, val]
          field.onChange(newValues)
        }

        return (
          <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
            <label className="text-sm font-semibold leading-5 text-neutral-800" htmlFor={inputId}>
              {label}
            </label>

            <div
              className={cn(
                'flex min-h-[42px] cursor-pointer flex-wrap gap-2 rounded-md border bg-white p-2 transition-all hover:border-[var(--color-primary)]',
                fieldState.invalid ? 'border-red-600' : 'border-neutral-300',
              )}
              onClick={() => setVisible(true)}
            >
              {selectedValues.length > 0 ? (
                selectedValues.map((val) => {
                  const option = options.find((o) => o.value === val)
                  return (
                    <span
                      key={val}
                      className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]"
                    >
                      {option?.label || val}
                    </span>
                  )
                })
              ) : (
                <span className="text-sm text-neutral-400">{placeholder}</span>
              )}
            </div>

            <Dialog
              visible={visible}
              onHide={() => setVisible(false)}
              header="Choose Prompt/Topic"
              style={{ width: '900px', maxWidth: '95vw' }}
              pt={{
                root: { className: 'rounded-3xl border-none shadow-2xl overflow-hidden' },
                header: { className: 'bg-[var(--color-surface)] text-[var(--color-text-strong)] border-b border-[var(--color-border-subtle)] p-8' },
                content: { className: 'bg-[var(--color-surface)] p-8' },
                footer: { className: 'bg-[var(--color-surface)] text-[var(--color-text)] border-none p-8 pt-2' },
                closeButton: { className: 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] focus:shadow-none' },
              }}
            >
              <p className="mb-8 font-sans text-base text-[var(--color-text-muted)]">
                Select your prompts/topics. We've organized them by category to help you find the most relevant options quickly.
              </p>

              <div className="custom-scrollbar flex max-h-[72vh] flex-col gap-8 overflow-y-auto p-1 pr-3">
                {Object.entries(categories).map(([cat, opts]) => (
                  <div 
                    key={cat} 
                    className="flex flex-col overflow-hidden rounded-[2.5rem] border border-[var(--color-primary)]/10 bg-[var(--color-primary-soft)]/40 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-primary)]/10 px-6 py-3.5">
                      <h3 className="font-sans text-[13px] font-black tracking-tight uppercase text-[var(--color-primary)]">
                        {cat}
                      </h3>
                      <span className="flex h-5 items-center rounded-full px-2.5 text-[9px] font-bold text-white uppercase tracking-wider bg-[var(--color-primary)]">
                        {opts.length} Prompts/Topics
                      </span>
                    </div>

                    {/* Subtopics Area */}
                    <div className="flex flex-wrap gap-2 p-5">
                      {opts.map((option) => {
                        const isSelected = selectedValues.includes(option.value)
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleValue(option.value)}
                            className={cn(
                              'group relative flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-sans text-[11px] font-bold transition-all duration-300 active:scale-95',
                              isSelected
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-ring)]'
                                : 'border-[var(--color-primary)]/10 bg-white/90 text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]',
                            )}
                          >
                            {option.label}
                            {isSelected && (
                              <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white animate-in zoom-in">
                                <svg className="h-2.5 w-2.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Button
                  label="Confirm Prompt/Topic"
                  onClick={() => setVisible(false)}
                  className="w-full rounded-[2rem] border-none bg-[var(--color-primary)] py-5 font-sans text-lg font-black text-white shadow-2xl shadow-[var(--color-ring)] transition-all hover:bg-[var(--color-primary-hover)] hover:scale-[1.01] active:scale-[0.99]"
                />
              </div>

              <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: var(--color-surface-elevated); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-border-strong); }
              `}} />
            </Dialog>

            <p
              id={`${inputId}-message`}
              className={cn(
                'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
                fieldState.error ? 'text-red-600' : 'text-neutral-500',
              )}
            >
              {fieldState.error?.message ?? helperText}
            </p>
          </div>
        )
      }}
    />
  )
}
