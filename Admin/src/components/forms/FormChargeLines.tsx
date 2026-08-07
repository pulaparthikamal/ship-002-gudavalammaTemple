import { Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useWatch } from 'react-hook-form'
import type { Control, FieldArrayPath, FieldPath, FieldValues, PathValue, UseFormClearErrors, UseFormSetValue } from 'react-hook-form'
import { Button } from 'primereact/button'
import { FormAutoComplete } from '@/components/forms/FormAutoComplete'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormNumber } from '@/components/forms/FormNumber'
import { FormTextarea } from '@/components/forms/FormTextarea'
import type { CrudSelectOption } from '@/types/crud'
import { cn } from '@/utils/classNames'

interface FormChargeLinesProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  disabled?: boolean
  containerClassName?: string
  providerOptions?: CrudSelectOption[]
  setValue?: UseFormSetValue<TFieldValues>
  clearErrors?: UseFormClearErrors<TFieldValues>
  validationMessages?: string[]
  codeOptions?: CrudSelectOption[]
}

function createEmptyChargeLine() {
  return {
    lineNumber: null,
    cptCode: '',
    icdCodes: '',
    icdPointers: '',
    modifiers: '',
    units: null,
    chargeAmount: null,
    diagnosisLinking: '',
    renderingProviderId: '',
  }
}

export function FormChargeLines<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  disabled = false,
  containerClassName,
  providerOptions = [],
  codeOptions = [],
  setValue,
  clearErrors,
  validationMessages = [],
}: FormChargeLinesProps<TFieldValues>) {
  const fieldArrayName = name as FieldArrayPath<TFieldValues>
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldArrayName,
  })
  const chargeLines = useWatch({
    control,
    name: name as FieldPath<TFieldValues>,
  }) as Array<{ chargeAmount?: number | null; lineNumber?: number | null }> | undefined
  const highlightedLineNumbers = new Set(
    validationMessages
      .map((message) => message.match(/(?:charge|claim)?\s*line\s+(\d+)/i)?.[1])
      .map((value) => (value ? Number(value) : NaN))
      .filter((value) => Number.isFinite(value) && value > 0),
  )

  useEffect(() => {
    if (!setValue || !Array.isArray(chargeLines)) {
      return
    }

    const total = chargeLines.reduce((sum, line) => (
      sum + (typeof line?.chargeAmount === 'number' && Number.isFinite(line.chargeAmount) ? line.chargeAmount : 0)
    ), 0)

    setValue(
      'totalChargeAmount' as FieldPath<TFieldValues>,
      total as PathValue<TFieldValues, FieldPath<TFieldValues>>,
      { shouldDirty: true, shouldValidate: true },
    )
  }, [chargeLines, setValue])

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', containerClassName)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]">{label}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {helperText ?? 'Capture every billable CPT, ICD linkage, and rendering provider before coding review.'}
          </p>
        </div>
        <Button
          type="button"
          label="Add Line"
          icon={<Plus className="h-3.5 w-3.5" />}
          className="h-8 px-3 text-xs font-semibold"
          onClick={() => append(createEmptyChargeLine() as never)}
          disabled={disabled}
        />
      </div>

      {validationMessages.length ? (
        <div className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]/10 p-3">
          <p className="text-xs font-bold uppercase text-[var(--color-danger-text)]">Coding review findings</p>
          <div className="mt-2 space-y-2">
            {validationMessages.map((message, index) => (
              <div key={`${message}-${index}`} className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-danger-text)]">
                {message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const linePrefix = `${name}.${index}` as const
          const currentLine = chargeLines?.[index]
          const displayLineNumber = currentLine?.lineNumber ?? index + 1
          const hasLineFinding = highlightedLineNumbers.has(displayLineNumber)

          return (
            <section
              key={field.id}
              className={cn(
                'space-y-3 rounded-xl border bg-[var(--color-surface-muted)]/55 p-4',
                hasLineFinding ? 'border-[var(--color-danger-border)] ring-1 ring-[var(--color-danger-border)]/40' : 'border-[var(--color-border)]',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-strong)]">Charge Line {index + 1}</h4>
                  {hasLineFinding ? (
                    <p className="mt-0.5 text-xs font-semibold text-[var(--color-danger-text)]">Coding review finding applies to this line.</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  label="Remove"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  severity="danger"
                  text
                  className="h-8 px-2 text-xs font-semibold"
                  onClick={() => remove(index)}
                  disabled={disabled || fields.length <= 1}
                />
              </div>

              <div className="grid gap-x-5 gap-y-3 md:grid-cols-2">
                <FormNumber
                  control={control}
                  name={`${linePrefix}.lineNumber` as FieldPath<TFieldValues>}
                  label="Line number"
                  disabled={disabled}
                />
                <FormAutoComplete
                  control={control}
                  name={`${linePrefix}.cptCode` as FieldPath<TFieldValues>}
                  label="CPT / CDT"
                  placeholder="Select ChargeMaster code"
                  options={codeOptions}
                  setValue={setValue}
                  clearErrors={clearErrors}
                  disabled={disabled}
                />
                <FormNumber
                  control={control}
                  name={`${linePrefix}.units` as FieldPath<TFieldValues>}
                  label="Units"
                  disabled={disabled}
                />
                <FormNumber
                  control={control}
                  name={`${linePrefix}.chargeAmount` as FieldPath<TFieldValues>}
                  label="Charge amount"
                  helperText="Repriced from active ChargeMaster on save."
                  min={0}
                  mode="currency"
                  currency="USD"
                  locale="en-US"
                  disabled={disabled}
                />
                <FormInputText
                  control={control}
                  name={`${linePrefix}.diagnosisLinking` as FieldPath<TFieldValues>}
                  label="Diagnosis linking"
                  placeholder="A, B or 1, 2"
                  disabled={disabled}
                />
                <FormAutoComplete
                  control={control}
                  name={`${linePrefix}.renderingProviderId` as FieldPath<TFieldValues>}
                  label="Rendering provider"
                  placeholder="Select provider"
                  options={providerOptions}
                  setValue={setValue}
                  clearErrors={clearErrors}
                  disabled={disabled}
                />
                <FormTextarea
                  control={control}
                  name={`${linePrefix}.icdCodes` as FieldPath<TFieldValues>}
                  label="Diagnosis codes"
                  rows={3}
                  helperText="Comma-separated or one per line."
                  containerClassName="col-span-full"
                  disabled={disabled}
                />
                <FormTextarea
                  control={control}
                  name={`${linePrefix}.icdPointers` as FieldPath<TFieldValues>}
                  label="Diagnosis pointers"
                  rows={3}
                  helperText="Comma-separated or one per line."
                  containerClassName="col-span-full"
                  disabled={disabled}
                />
                <FormTextarea
                  control={control}
                  name={`${linePrefix}.modifiers` as FieldPath<TFieldValues>}
                  label="Modifiers"
                  rows={3}
                  helperText="Comma-separated or one per line."
                  containerClassName="col-span-full"
                  disabled={disabled}
                />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
