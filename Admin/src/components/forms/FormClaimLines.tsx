import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray } from 'react-hook-form'
import type { Control, FieldArrayPath, FieldPath, FieldValues, UseFormClearErrors, UseFormSetValue } from 'react-hook-form'
import { Button } from 'primereact/button'
import { FormAutoComplete } from '@/components/forms/FormAutoComplete'
import { FormDatePicker } from '@/components/forms/FormDatePicker'
import { FormDropdown } from '@/components/forms/FormDropdown'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormNumber } from '@/components/forms/FormNumber'
import { FormTextarea } from '@/components/forms/FormTextarea'
import type { CrudSelectOption } from '@/types/crud'
import { cn } from '@/utils/classNames'

interface FormClaimLinesProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  disabled?: boolean
  containerClassName?: string
  providerOptions?: CrudSelectOption[]
  placeOfServiceOptions?: CrudSelectOption[]
  setValue?: UseFormSetValue<TFieldValues>
  clearErrors?: UseFormClearErrors<TFieldValues>
}

function createEmptyClaimLine() {
  return {
    lineNumber: null,
    chargeLineId: '',
    cptCode: '',
    modifiers: '',
    icdPointers: '',
    units: null,
    chargeAmount: null,
    renderingProviderId: '',
    placeOfService: '',
    serviceDateFrom: null,
    serviceDateTo: null,
  }
}

export function FormClaimLines<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  disabled = false,
  containerClassName,
  providerOptions = [],
  placeOfServiceOptions = [],
  setValue,
  clearErrors,
}: FormClaimLinesProps<TFieldValues>) {
  const fieldArrayName = name as FieldArrayPath<TFieldValues>
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldArrayName,
  })

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', containerClassName)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]">{label}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {helperText ?? 'Review every service line before claim submission, including dates, POS, pointers, and provider assignment.'}
          </p>
        </div>
        <Button
          type="button"
          label="Add Line"
          icon={<Plus className="h-3.5 w-3.5" />}
          className="h-8 px-3 text-xs font-semibold"
          onClick={() => append(createEmptyClaimLine() as never)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const linePrefix = `${name}.${index}` as const

          return (
            <section
              key={field.id}
              className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[var(--color-text-strong)]">Claim Line {index + 1}</h4>
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
                <FormInputText
                  control={control}
                  name={`${linePrefix}.chargeLineId` as FieldPath<TFieldValues>}
                  label="Charge line ID"
                  placeholder="Source charge line"
                  disabled={disabled}
                />
                <FormInputText
                  control={control}
                  name={`${linePrefix}.cptCode` as FieldPath<TFieldValues>}
                  label="CPT / HCPCS"
                  placeholder="99213"
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
                <FormDropdown
                  control={control}
                  name={`${linePrefix}.placeOfService` as FieldPath<TFieldValues>}
                  label="Place of service"
                  options={placeOfServiceOptions}
                  placeholder="Select POS"
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
                  min={0}
                  mode="currency"
                  currency="USD"
                  locale="en-US"
                  disabled={disabled}
                />
                <FormDatePicker
                  control={control}
                  name={`${linePrefix}.serviceDateFrom` as FieldPath<TFieldValues>}
                  label="Service from"
                  showButtonBar
                  disabled={disabled}
                />
                <FormDatePicker
                  control={control}
                  name={`${linePrefix}.serviceDateTo` as FieldPath<TFieldValues>}
                  label="Service to"
                  showButtonBar
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
