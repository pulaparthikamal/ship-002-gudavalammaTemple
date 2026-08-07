import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { MultiSelect } from 'primereact/multiselect'
import { cn } from '@/utils/classNames'

interface FormMultiSelectProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  options: Array<{ label: string; value: any }>
  helperText?: string
  placeholder?: string
  disabled?: boolean
  containerClassName?: string
}

export function FormMultiSelect<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  helperText,
  placeholder,
  disabled,
  containerClassName,
}: FormMultiSelectProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('flex flex-col gap-1.5', containerClassName)}>
          <label 
            className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" 
            htmlFor={inputId}
          >
            {label}
          </label>
          
          <MultiSelect
            id={inputId}
            value={field.value || []}
            options={options}
            onChange={(e) => field.onChange(e.value)}
            placeholder={placeholder}
            disabled={disabled}
            display="chip"
            className={cn('w-full', fieldState.invalid && 'p-invalid')}
          />

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
      )}
    />
  )
}
