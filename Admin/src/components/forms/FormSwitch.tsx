import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { InputSwitch } from 'primereact/inputswitch'
import type { InputSwitchProps } from 'primereact/inputswitch'
import { cn } from '@/utils/classNames'

interface FormSwitchProps<TFieldValues extends FieldValues>
  extends Omit<InputSwitchProps, 'name' | 'checked' | 'onChange'> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  checkedLabel?: string
  uncheckedLabel?: string
}

export function FormSwitch<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  checkedLabel = 'Enabled',
  uncheckedLabel = 'Disabled',
  ...switchProps
}: FormSwitchProps<TFieldValues>) {
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
          <div className="flex min-h-[2.75rem] items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            <span
              className={cn(
                'text-sm font-medium',
                field.value ? 'text-[var(--color-text-strong)]' : 'text-[var(--color-text-muted)]',
              )}
            >
              {field.value ? checkedLabel : uncheckedLabel}
            </span>
            <InputSwitch
              {...switchProps}
              inputId={inputId}
              name={field.name}
              checked={Boolean(field.value)}
              className="shrink-0"
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(Boolean(event.value))}
            />
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
      )}
    />
  )
}
