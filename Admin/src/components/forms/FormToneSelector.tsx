import { useState, useRef } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { cn } from '@/utils/classNames'
import { useGetTonesQuery, useCreateToneMutation, useDeleteToneMutation } from '@/services/api/endpoints/tonesApi'
import { Trash2, Plus, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import type { EntityId } from '@/types/common'


const toneSelectorStyles = `
  .tone-selector .p-dropdown-clear-icon {
    margin-top: 0 !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }
  .tone-selector-panel .p-dropdown-items .p-dropdown-item {
    padding-right: 0.5rem !important;
  }
`

interface FormToneSelectorProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  placeholder?: string
  containerClassName?: string
}

interface ToneOption {
  label: string
  value: string
  id: EntityId
}

function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return undefined
  const data = error.data
  if (!data || typeof data !== 'object' || !('respMessage' in data)) return undefined
  return typeof data.respMessage === 'string' ? data.respMessage : undefined
}

export function FormToneSelector<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  placeholder,
  containerClassName,
}: FormToneSelectorProps<TFieldValues>) {
  const { showToast } = useToast()
  const { data: tones = [], isLoading } = useGetTonesQuery()
  const [createTone, { isLoading: isCreating }] = useCreateToneMutation()
  const [deleteTone] = useDeleteToneMutation()

  const [newToneName, setNewToneName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAddTone = async (e: React.MouseEvent | React.KeyboardEvent, onChange: (value: string) => void) => {
    e.stopPropagation()
    e.preventDefault()
    const trimmed = newToneName.trim()
    if (!trimmed) return
    try {
      await createTone({ name: trimmed }).unwrap()
      onChange(trimmed)
      setNewToneName('')
      setIsAdding(false)
      showToast({ severity: 'success', summary: 'Tone added', detail: `"${trimmed}" has been added and selected.` })
    } catch (error: unknown) {
      showToast({ severity: 'error', summary: 'Error', detail: getApiErrorMessage(error) || 'Failed to add tone' })
    }
  }

  const handleDeleteTone = async (id: EntityId, toneName: string, e: React.MouseEvent, currentValue: string, onChange: (value: string) => void) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await deleteTone(id).unwrap()
      if (String(currentValue || '').toLowerCase() === toneName.toLowerCase()) {
        const nextTone = options.find(option => String(option.id) !== String(id))
        onChange(nextTone?.value || '')
      }
      showToast({ severity: 'success', summary: 'Tone deleted', detail: `"${toneName}" has been removed.` })
    } catch {
      showToast({ severity: 'error', summary: 'Error', detail: 'Failed to delete tone' })
    }
  }

  const handleCancelAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setNewToneName('')
    setIsAdding(false)
  }

  const handleStartAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAdding(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const options = tones.map(t => ({
    label: t.name,
    value: t.name,
    id: t._id,
  }))

  return (
    <>
      <style>{toneSelectorStyles}</style>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => {
          const matchedValue = options.find(
            option => option.value.toLowerCase() === String(field.value || '').toLowerCase(),
          )?.value

          const itemTemplate = (option: ToneOption) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: '14px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {option.label}
              </span>
              <button
                type="button"
                onMouseDown={(e) => handleDeleteTone(option.id, option.label, e, field.value, field.onChange)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, height: '26px', width: '26px', borderRadius: '4px',
                  color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget).style.background = '#fef2f2'; }}
                onMouseLeave={(e) => { (e.currentTarget).style.background = 'transparent'; }}
                title={`Delete "${option.label}"`}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          )

          const panelFooterTemplate = () => (
            <div className="border-t border-[var(--color-border)]">
              {!isAdding ? (
                <button
                  type="button"
                  onMouseDown={handleStartAdd}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Custom Tone
                </button>
              ) : (
                <div className="p-2 space-y-2 bg-[var(--color-surface-muted)]">
                  <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide px-0.5">New Tone</p>
                  <InputText
                    ref={inputRef}
                    value={newToneName}
                    onChange={(e) => setNewToneName(e.target.value)}
                    placeholder="e.g. Friendly, Formal..."
                    className="w-full text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTone(e, field.onChange)
                      if (e.key === 'Escape') {
                        setNewToneName('')
                        setIsAdding(false)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      onMouseDown={(e) => handleCancelAdd(e)}
                      className="flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!newToneName.trim() || isCreating}
                      onMouseDown={(e) => handleAddTone(e, field.onChange)}
                      className="flex h-7 items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? (
                        <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Save & Select
                    </button>
                  </div>
                </div>
              )}
            </div>
          )

          return (
            <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
              <label
                className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]"
                htmlFor={name.replaceAll('.', '-')}
              >
                {label}
              </label>
              <Dropdown
                id={name.replaceAll('.', '-')}
                value={matchedValue || field.value || null}
                options={options}
                onChange={(e) => field.onChange(e.value)}
                placeholder={placeholder ?? 'Select a tone...'}
                className={cn('w-full tone-selector', fieldState.invalid && 'p-invalid')}
                panelClassName="tone-selector-panel"
                itemTemplate={itemTemplate}
                panelFooterTemplate={panelFooterTemplate}
                filter
                filterPlaceholder="Search tones..."
                showClear
                loading={isLoading}
                emptyMessage="No tones yet. Add one below."
                emptyFilterMessage="No tones found."
              />
              <p
                className={cn(
                  'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
                  fieldState.error ? 'text-red-600' : 'text-[var(--color-text-muted)]',
                )}
              >
                {fieldState.error?.message ?? helperText}
              </p>
            </div>
          )
        }}
      />
    </>
  )
}
