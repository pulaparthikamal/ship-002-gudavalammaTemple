import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Dropdown } from 'primereact/dropdown'
import type { DropdownProps } from 'primereact/dropdown'
import { cn } from '@/utils/classNames'

export interface SelectOption<TValue extends string | number | boolean = string> {
  label: string
  value: TValue
}

interface FormDropdownProps<TFieldValues extends FieldValues>
  extends Omit<DropdownProps, 'name' | 'value' | 'onChange' | 'options'> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  options: Array<SelectOption<string | number | boolean>>
  helperText?: string
  containerClassName?: string
}

export function FormDropdown<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  helperText,
  containerClassName,
  className,
  ...dropdownProps
}: FormDropdownProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
          <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
            {label}
          </label>
          <Dropdown
            {...dropdownProps}
            inputId={inputId}
            name={field.name}
            value={field.value}
            options={options}
            optionLabel="label"
            optionValue="value"
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.value)}
            className={cn(fieldState.invalid && 'p-invalid', className)}
            aria-describedby={`${inputId}-message`}
          />
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
      )}
    />
  )
}
