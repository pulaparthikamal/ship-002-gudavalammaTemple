import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Checkbox } from 'primereact/checkbox'
import type { CheckboxProps } from 'primereact/checkbox'
import { cn } from '@/utils/classNames'

interface FormCheckboxProps<TFieldValues extends FieldValues>
  extends Omit<CheckboxProps, 'name' | 'checked' | 'onChange'> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  compact?: boolean
}

export function FormCheckbox<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  compact = false,
  ...checkboxProps
}: FormCheckboxProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg bg-[var(--color-surface)]',
              compact
                ? 'min-h-0 px-0 py-0'
                : 'min-h-[2.625rem] border border-[var(--color-border)] px-3 py-2',
            )}
          >
            <Checkbox
              {...checkboxProps}
              inputId={inputId}
              name={field.name}
              checked={Boolean(field.value)}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(Boolean(event.checked))}
            />
            <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
              {label}
            </label>
          </div>
          {!compact || fieldState.error || helperText ? (
            <p
              id={`${inputId}-message`}
              className={cn(
                compact
                  ? 'px-0.5 pt-0.5 text-xs leading-[1.125rem]'
                  : 'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
                fieldState.error ? 'text-red-600' : 'text-[var(--color-text-muted)]',
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
