import { useMemo } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Calendar } from 'primereact/calendar'
import type { CalendarProps } from 'primereact/calendar'
import { cn } from '@/utils/classNames'

interface FormTimePickerProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  containerClassName?: string
  className?: string
  inputClassName?: string
  hourFormat?: CalendarProps['hourFormat']
  readOnlyInput?: CalendarProps['readOnlyInput']
  showButtonBar?: CalendarProps['showButtonBar']
  showIcon?: boolean
  stepHour?: number
  stepMinute?: number
  touchUI?: CalendarProps['touchUI']
}

/**
 * Normalizes any time value into a stable Date object.
 * Uses a fixed base date (2000-01-01) to ensure React 19 / PrimeReact 10 compatibility.
 */
function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(2000, 0, 1, value.getHours(), value.getMinutes(), 0, 0);
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  // Handle ISO or HH:mm or HH:mm:ss format
  const match = value.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp][Mm])?$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[4]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return new Date(2000, 0, 1, h, m, 0, 0);
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return new Date(2000, 0, 1, d.getHours(), d.getMinutes(), 0, 0);
  }

  return null;
}

function toTimeString(value: Date): string {
  const h = String(value.getHours()).padStart(2, '0');
  const m = String(value.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function FormTimePicker<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  placeholder,
  disabled,
  containerClassName,
  className,
  inputClassName,
  hourFormat = '12',
  readOnlyInput = true,
  showButtonBar = true,
  showIcon = true,
  stepHour = 1,
  stepMinute = 1,
  touchUI,
}: FormTimePickerProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        // useMemo is CRITICAL here. React 19's rendering engine will cause the 
        // PrimeReact time picker to display "NaN" if this Date reference is not stable.
        const calendarValue = useMemo(() => toValidDate(field.value), [field.value]);

        return (
          <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
            <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
              {label}
            </label>
            <Calendar
              inputId={inputId}
              name={field.name}
              value={calendarValue}
              timeOnly
              hourFormat={hourFormat}
              readOnlyInput={readOnlyInput}
              showButtonBar={showButtonBar}
              showIcon={showIcon}
              stepHour={stepHour}
              stepMinute={stepMinute}
              touchUI={touchUI}
              autoZIndex
              baseZIndex={3000}
              disabled={disabled}
              placeholder={placeholder || "Select Time"}
              onBlur={field.onBlur}
              onChange={(e) => {
                if (e.value instanceof Date && !isNaN(e.value.getTime())) {
                  field.onChange(toTimeString(e.value));
                } else {
                  field.onChange('');
                }
              }}
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
        )
      }}
    />
  )
}
