import { useState } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Chips } from 'primereact/chips'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils/classNames'

interface FormTagInputProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  containerClassName?: string
  options?: Array<{ label: string; value: string; category?: string }>
  maxItems?: number
  maxLength?: number
  showCharacterCount?: boolean
  commitOnBlur?: boolean
  removeButtonPosition?: 'start' | 'end'
  valueMode?: 'array' | 'string'
  singleValueEditor?: 'chip' | 'textarea'
  rows?: number
  onDeleteOption?: (value: string) => void | Promise<void>
}

export function FormTagInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  placeholder,
  disabled,
  containerClassName,
  options,
  maxItems,
  maxLength,
  showCharacterCount,
  commitOnBlur,
  removeButtonPosition = 'end',
  valueMode = 'array',
  singleValueEditor = 'chip',
  rows = 6,
  onDeleteOption,
}: FormTagInputProps<TFieldValues>) {
  const [visible, setVisible] = useState(false)
  const [draftValue, setDraftValue] = useState('')
  const [suggestionSearch, setSuggestionSearch] = useState('')
  const inputId = name.replaceAll('.', '-')
  const isSingleValue = maxItems === 1

  const visibleOptions = (options || []).filter((opt) => {
    const query = suggestionSearch.trim().toLowerCase()
    if (!query) return true

    return [opt.label, opt.value, opt.category || 'General'].some((value) =>
      value.toLowerCase().includes(query),
    )
  })

  // Group options by category for the popup
  const categories = visibleOptions.reduce((acc, opt) => {
    const cat = opt.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(opt)
    return acc
  }, {} as Record<string, typeof options>)
  const categoryEntries = Object.entries(categories)

  const openSuggestions = () => {
    setSuggestionSearch('')
    setVisible(true)
  }

  const suggestionSearchInput = (
    <div className="mb-4 flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-ring)]">
      <Search className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      <input
        value={suggestionSearch}
        onChange={(event) => setSuggestionSearch(event.target.value)}
        placeholder="Search suggestions"
        className="min-w-0 flex-1 border-none bg-transparent text-xs text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-muted)]"
        autoFocus
      />
      {suggestionSearch ? (
        <button
          type="button"
          onClick={() => setSuggestionSearch('')}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-red-600"
          aria-label="Clear suggestion search"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value as unknown
        const currentValues = Array.isArray(rawValue)
          ? rawValue.filter((value): value is string => typeof value === 'string')
          : typeof rawValue === 'string' && rawValue.trim()
            ? [rawValue]
            : []
        const selectedValue = currentValues[0] || ''
        const displayedDraft = draftValue || (!selectedValue ? '' : selectedValue)
        const characterCount = selectedValue ? selectedValue.length : draftValue.length

        const emitSingleValue = (value: string) => {
          field.onChange(valueMode === 'string' ? value : value ? [value] : [])
        }

        const commitValue = (value: string) => {
          const trimmed = value.trim()
          if (!trimmed) {
            emitSingleValue('')
            setDraftValue('')
            return
          }

          const limited = maxLength ? trimmed.slice(0, maxLength) : trimmed
          emitSingleValue(limited)
          setDraftValue('')
        }

        const clearSingleValue = () => {
          emitSingleValue('')
          setDraftValue('')
        }

        const toggleOption = (val: string) => {
          const limitedValue = maxLength ? val.slice(0, maxLength) : val
          if (currentValues.includes(limitedValue)) {
            if (maxItems === 1) {
              emitSingleValue('')
            } else {
              field.onChange(currentValues.filter(v => v !== limitedValue))
            }
          } else {
            if (maxItems === 1) {
              emitSingleValue(limitedValue)
              setDraftValue('')
              setVisible(false)
            } else {
              if (maxItems && currentValues.length >= maxItems) return
              field.onChange([...currentValues, limitedValue])
            }
          }
        }

        const deleteOption = async (val: string) => {
          const limitedValue = maxLength ? val.slice(0, maxLength) : val
          await onDeleteOption?.(val)
          if (currentValues.includes(limitedValue)) {
            clearSingleValue()
          }
        }

        if (isSingleValue) {
          const removeButton = selectedValue ? (
            <button
              type="button"
              onClick={clearSingleValue}
              disabled={disabled}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[var(--color-primary)] shadow-sm transition-colors hover:bg-white hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Remove ${label}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null

          return (
            <div className={cn('flex flex-col gap-1.5', containerClassName)}>
              <div className="flex items-center justify-between gap-3">
                <label
                  className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]"
                  htmlFor={inputId}
                >
                  {label}
                </label>
                <div className="flex items-center gap-3">
                  {singleValueEditor === 'textarea' && selectedValue ? (
                    <button
                      type="button"
                      onClick={clearSingleValue}
                      disabled={disabled}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--color-text-muted)] hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Clear
                    </button>
                  ) : null}
                  {options && options.length > 0 && (
                    <button
                      type="button"
                      onClick={openSuggestions}
                      disabled={disabled}
                      className="text-[10px] font-bold uppercase text-[var(--color-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Browse Suggestions
                    </button>
                  )}
                </div>
              </div>

              {singleValueEditor === 'textarea' ? (
                <textarea
                  id={inputId}
                  value={displayedDraft}
                  onChange={(event) => {
                    const nextValue = maxLength ? event.target.value.slice(0, maxLength) : event.target.value
                    setDraftValue(nextValue)
                    emitSingleValue(nextValue.trim() ? nextValue : '')
                  }}
                  onBlur={() => {
                    if (commitOnBlur) commitValue(displayedDraft)
                    field.onBlur()
                  }}
                  rows={rows}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  disabled={disabled}
                  className={cn(
                    'w-full resize-y rounded-md border bg-[var(--color-surface)] px-3 py-2 text-sm leading-6 text-[var(--color-text-strong)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]',
                    fieldState.invalid ? 'border-red-600' : 'border-[var(--color-border)]',
                    disabled && 'cursor-not-allowed opacity-70',
                  )}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`${inputId}-message`}
                />
              ) : selectedValue && !draftValue ? (
                <div
                  className={cn(
                    'flex min-h-[42px] items-start rounded-md border bg-[var(--color-surface)] p-2',
                    fieldState.invalid ? 'border-red-600' : 'border-[var(--color-border)]',
                    disabled && 'opacity-70',
                  )}
                >
                  <span className="inline-flex max-w-full items-start gap-2 rounded-md bg-[var(--color-primary-soft)] px-2.5 py-1.5 text-sm font-semibold leading-5 text-[var(--color-primary)] [overflow-wrap:anywhere]">
                    {removeButtonPosition === 'start' && removeButton}
                    {selectedValue}
                    {removeButtonPosition === 'end' && removeButton}
                  </span>
                </div>
              ) : (
                <input
                  id={inputId}
                  value={displayedDraft}
                  onChange={(event) => {
                    const nextValue = maxLength ? event.target.value.slice(0, maxLength) : event.target.value
                    setDraftValue(nextValue)
                    emitSingleValue(nextValue.trim() ? nextValue : '')
                  }}
                  onBlur={() => {
                    if (commitOnBlur) commitValue(displayedDraft)
                    field.onBlur()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitValue(displayedDraft)
                    }
                  }}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  disabled={disabled}
                  className={cn(
                    'min-h-[42px] w-full rounded-md border bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-strong)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]',
                    fieldState.invalid ? 'border-red-600' : 'border-[var(--color-border)]',
                    disabled && 'cursor-not-allowed opacity-70',
                  )}
                />
              )}

              <div className="flex min-h-[1.125rem] items-start justify-between gap-3 px-0.5 pt-0.5">
                <p
                  id={`${inputId}-message`}
                  className={cn(
                    'text-xs leading-[1.125rem]',
                    fieldState.error ? 'font-medium text-red-600' : 'text-[var(--color-text-muted)]'
                  )}
                >
                  {fieldState.error?.message ?? helperText}
                </p>
                {showCharacterCount && maxLength ? (
                  <span
                    className={cn(
                      'shrink-0 text-xs leading-[1.125rem] text-[var(--color-text-muted)]',
                      characterCount >= maxLength && 'font-semibold text-amber-700',
                    )}
                  >
                    {characterCount}/{maxLength}
                  </span>
                ) : null}
              </div>

              <Dialog
                visible={visible}
                onHide={() => setVisible(false)}
                header={`Select ${label}`}
                style={{ width: '600px', maxWidth: '95vw' }}
                pt={{
                  root: { className: 'rounded-2xl border-none shadow-2xl overflow-hidden' },
                  header: { className: 'bg-[var(--color-surface)] text-[var(--color-text-strong)] border-b border-[var(--color-border-subtle)] p-6' },
                  content: { className: 'bg-[var(--color-surface)] p-6' },
                  footer: { className: 'bg-[var(--color-surface)] border-t border-[var(--color-border-subtle)] p-4' },
                  closeButton: { className: 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] focus:shadow-none' },
                }}
              >
                {suggestionSearchInput}
                <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                  {categoryEntries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                      No suggestions found.
                    </div>
                  ) : categoryEntries.map(([cat, opts]) => (
                    <div key={cat} className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-primary)] opacity-70">
                        {cat}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {opts?.map((opt) => {
                          const isSelected = currentValues.includes(opt.value)
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleOption(opt.value)}
                              className={cn(
                                'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                                isSelected
                                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-md'
                                  : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                              )}
                            >
                              {opt.label}
                              {isSelected && (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {onDeleteOption && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Delete ${opt.label}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void deleteOption(opt.value)
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      void deleteOption(opt.value)
                                    }
                                  }}
                                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[var(--color-primary)] hover:text-red-600"
                                >
                                  <X className="h-3 w-3" aria-hidden="true" />
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <Button
                    label="Done"
                    onClick={() => setVisible(false)}
                    className="w-full rounded-xl border-none bg-[var(--color-primary)] py-3 font-bold text-white shadow-lg transition-all hover:bg-[var(--color-primary-hover)]"
                  />
                </div>
                <style dangerouslySetInnerHTML={{ __html: `
                  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                  .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }
                `}} />
              </Dialog>
            </div>
          )
        }

        return (
          <div className={cn('flex flex-col gap-1.5', containerClassName)}>
            <div className="flex items-center justify-between">
              <label
                className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]"
                htmlFor={inputId}
              >
                {label}
              </label>
              {options && options.length > 0 && (
                <button
                  type="button"
                  onClick={openSuggestions}
                  className="text-[10px] font-bold uppercase text-[var(--color-primary)] hover:underline"
                >
                  Browse Suggestions
                </button>
              )}
            </div>

            <Chips
              id={inputId}
              value={currentValues}
              onChange={(e) => field.onChange(e.value)}
              placeholder={placeholder}
              disabled={disabled}
              max={maxItems}
              addOnBlur={commitOnBlur}
              className={cn('w-full', fieldState.invalid && 'p-invalid')}
              pt={{
                container: { className: 'w-full min-h-[42px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1' },
                token: { className: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold rounded-full px-3 py-1' },
                inputToken: { className: 'flex-1' },
                input: { className: 'w-full border-none shadow-none focus:shadow-none bg-transparent text-sm' }
              }}
            />

            <Dialog
              visible={visible}
              onHide={() => setVisible(false)}
              header={`Select ${label}`}
              style={{ width: '600px', maxWidth: '95vw' }}
              pt={{
                root: { className: 'rounded-2xl border-none shadow-2xl overflow-hidden' },
                header: { className: 'bg-[var(--color-surface)] text-[var(--color-text-strong)] border-b border-[var(--color-border-subtle)] p-6' },
                content: { className: 'bg-[var(--color-surface)] p-6' },
                footer: { className: 'bg-[var(--color-surface)] border-t border-[var(--color-border-subtle)] p-4' },
                closeButton: { className: 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] focus:shadow-none' },
              }}
            >
              {suggestionSearchInput}
              <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {categoryEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    No suggestions found.
                  </div>
                ) : categoryEntries.map(([cat, opts]) => (
                  <div key={cat} className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-primary)] opacity-70">
                      {cat}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {opts?.map((opt) => {
                        const isSelected = currentValues.includes(opt.value)
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleOption(opt.value)}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5',
                              isSelected
                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md'
                                : 'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                            )}
                          >
                            {opt.label}
                            {isSelected && (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Button
                  label="Done"
                  onClick={() => setVisible(false)}
                  className="w-full rounded-xl border-none bg-[var(--color-primary)] py-3 font-bold text-white shadow-lg transition-all hover:bg-[var(--color-primary-hover)]"
                />
              </div>
              <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }
              `}} />
            </Dialog>

            {fieldState.error || helperText ? (
              <p
                id={`${inputId}-message`}
                className={cn(
                  'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
                  fieldState.error ? 'text-red-600 font-medium' : 'text-[var(--color-text-muted)]'
                )}
              >
                {fieldState.error?.message ?? helperText}
              </p>
            ) : null}
          </div>
        )
      }}
    />
  )
}
