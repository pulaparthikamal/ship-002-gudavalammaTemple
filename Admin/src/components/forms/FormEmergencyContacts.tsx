import { Plus, Trash2 } from 'lucide-react'
import { Button } from 'primereact/button'
import { useController, useFieldArray } from 'react-hook-form'
import type { Control, FieldArrayPath, FieldPath, FieldValues } from 'react-hook-form'
import { FormDropdown } from '@/components/forms/FormDropdown'
import { FormInputText } from '@/components/forms/FormInputText'
import type { CrudSelectOption } from '@/types/crud'
import { cn } from '@/utils/classNames'

interface FormEmergencyContactsProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  disabled?: boolean
  maxItems?: number
  relationshipOptions?: CrudSelectOption[]
}

const emptyEmergencyContact = {
  firstName: '',
  lastName: '',
  relationship: '',
  phone: '',
  email: '',
}

export function FormEmergencyContacts<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  disabled = false,
  maxItems = 5,
  relationshipOptions = [],
}: FormEmergencyContactsProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')
  const { fieldState } = useController({ control, name })
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as FieldArrayPath<TFieldValues>,
  })

  const canAddMore = !disabled && fields.length < maxItems

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', containerClassName)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
          {label}
        </label>
        <Button
          type="button"
          label="Add contact"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          severity="secondary"
          outlined
          disabled={!canAddMore}
          onClick={() => append({ ...emptyEmergencyContact } as never)}
        />
      </div>

      <div className="space-y-3">
        {fields.length ? (
          fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">Contact {index + 1}</p>
                <Button
                  type="button"
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  text
                  severity="danger"
                  disabled={disabled}
                  aria-label={`Remove contact ${index + 1}`}
                  onClick={() => remove(index)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <FormInputText
                  control={control}
                  name={`${name}.${index}.firstName` as FieldPath<TFieldValues>}
                  label="First name"
                  placeholder="First name"
                  disabled={disabled}
                />
                <FormInputText
                  control={control}
                  name={`${name}.${index}.lastName` as FieldPath<TFieldValues>}
                  label="Last name"
                  placeholder="Last name"
                  disabled={disabled}
                />
                <FormDropdown
                  control={control}
                  name={`${name}.${index}.relationship` as FieldPath<TFieldValues>}
                  label="Relationship"
                  placeholder="Select relationship"
                  options={relationshipOptions}
                  disabled={disabled}
                />
                <FormInputText
                  control={control}
                  name={`${name}.${index}.phone` as FieldPath<TFieldValues>}
                  label="Phone"
                  placeholder="Phone number"
                  disabled={disabled}
                />
                <FormInputText
                  control={control}
                  name={`${name}.${index}.email` as FieldPath<TFieldValues>}
                  label="Email"
                  type="email"
                  placeholder="contact@example.com"
                  disabled={disabled}
                  containerClassName="md:col-span-2"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
            No emergency contacts added yet.
          </div>
        )}
      </div>

      <p
        id={`${inputId}-message`}
        className={cn(
          'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
          fieldState.error ? 'text-red-600' : 'text-[var(--color-text-muted)]',
        )}
      >
        {fieldState.error?.message ?? helperText}
      </p>
    </div>
  )
}
