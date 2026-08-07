import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { InputTextarea } from 'primereact/inputtextarea'
import type { InputTextareaProps } from 'primereact/inputtextarea'
import { cn } from '@/utils/classNames'

interface FormTextareaProps<TFieldValues extends FieldValues>
  extends Omit<InputTextareaProps, 'name' | 'value' | 'onChange'> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
}

export function FormTextarea<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  className,
  ...textareaProps
}: FormTextareaProps<TFieldValues>) {
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
          <InputTextarea
            {...textareaProps}
            id={inputId}
            name={field.name}
            value={String(field.value ?? '')}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.value)}
            className={cn('w-full', fieldState.invalid && 'p-invalid', className)}
            aria-invalid={fieldState.invalid}
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
