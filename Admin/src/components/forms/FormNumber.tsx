import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberProps } from 'primereact/inputnumber'
import { cn } from '@/utils/classNames'

interface FormNumberProps<TFieldValues extends FieldValues>
  extends Omit<InputNumberProps, 'name' | 'value' | 'onValueChange'> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
}

export function FormNumber<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  className,
  inputClassName,
  ...numberProps
}: FormNumberProps<TFieldValues>) {
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
          <InputNumber
            {...numberProps}
            inputId={inputId}
            name={field.name}
            value={typeof field.value === 'number' ? field.value : null}
            onBlur={field.onBlur}
            onValueChange={(event) => field.onChange(event.value ?? null)}
            inputClassName={cn('w-full', fieldState.invalid && 'p-invalid', inputClassName)}
            className={cn('w-full', className)}
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
