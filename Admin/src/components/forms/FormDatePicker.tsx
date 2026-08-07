import { useEffect, useRef, useState } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Calendar } from 'primereact/calendar'
import type { CalendarProps, CalendarSelectionMode } from 'primereact/calendar'
import { cn } from '@/utils/classNames'

type CalendarFieldValue = Date | Date[] | (Date | null)[]

interface FormDatePickerProps<TFieldValues extends FieldValues>
  extends Omit<
    CalendarProps<CalendarSelectionMode, CalendarFieldValue>,
    'name' | 'value' | 'onChange'
  > {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  displayMode?: 'popup' | 'inline'
}

export function FormDatePicker<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  displayMode = 'popup',
  className,
  inputClassName,
  ...calendarProps
}: FormDatePickerProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isInlineOpen, setIsInlineOpen] = useState(false)

  function parseDateValue(value: unknown) {
    if (value instanceof Date) {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const parsedDate = new Date(value)
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
    }

    return null
  }

  function normalizeCalendarValue(value: unknown) {
    const dateValue = parseDateValue(value)

    if (dateValue) {
      return dateValue
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => parseDateValue(item))
        .filter((item): item is Date | null => item instanceof Date || item === null)
    }

    return null
  }

  function formatDisplayValue(value: unknown) {
    const dateValue = parseDateValue(value)

    if (!dateValue) {
      return ''
    }

    if (calendarProps.showTime) {
      return new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: calendarProps.hourFormat !== '24',
      }).format(dateValue)
    }

    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(dateValue)
  }

  function formatDateTimeLocalValue(value: unknown) {
    const dateValue = parseDateValue(value)

    if (!dateValue) {
      return ''
    }

    const year = dateValue.getFullYear()
    const month = String(dateValue.getMonth() + 1).padStart(2, '0')
    const day = String(dateValue.getDate()).padStart(2, '0')
    const hours = String(dateValue.getHours()).padStart(2, '0')
    const minutes = String(dateValue.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function parseDateTimeLocalValue(value: string) {
    if (!value) {
      return null
    }

    // datetime-local format: "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss"
    // Parse each component individually so the Date is always LOCAL, never UTC
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (match) {
      const [, y, mo, d, h, mi, s] = match
      const date = new Date(
        Number(y), Number(mo) - 1, Number(d),
        Number(h), Number(mi), Number(s ?? 0)
      )
      return isNaN(date.getTime()) ? null : date
    }

    // Fallback for any other string format (ISO with tz offset, etc.)
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  useEffect(() => {
    if (!isInlineOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsInlineOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isInlineOpen])

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div ref={containerRef} className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
          <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
            {label}
          </label>
          {calendarProps.showTime ? (
            <input
              id={inputId}
              type="datetime-local"
              name={field.name}
              value={formatDateTimeLocalValue(field.value)}
              min={formatDateTimeLocalValue(calendarProps.minDate) || undefined}
              max={formatDateTimeLocalValue(calendarProps.maxDate) || undefined}
              disabled={calendarProps.disabled}
              placeholder={calendarProps.placeholder}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(parseDateTimeLocalValue(event.target.value))}
              className={cn(
                'w-full p-inputtext p-component',
                fieldState.invalid && 'p-invalid',
                className,
                inputClassName,
              )}
              aria-invalid={fieldState.invalid}
              aria-describedby={`${inputId}-message`}
            />
          ) : displayMode === 'inline' ? (
            <div className="relative">
              <div
                className={cn(
                  'p-calendar p-component p-calendar-w-btn p-calendar-w-btn-right relative w-full',
                  className,
                )}
              >
                <input
                  id={inputId}
                  type="text"
                  name={field.name}
                  readOnly
                  value={formatDisplayValue(field.value)}
                  placeholder={calendarProps.placeholder}
                  onClick={() => setIsInlineOpen((currentValue) => !currentValue)}
                  className={cn(
                    'w-full p-inputtext p-component',
                    fieldState.invalid && 'p-invalid',
                    inputClassName,
                  )}
                  aria-invalid={fieldState.invalid}
                  aria-expanded={isInlineOpen}
                  aria-describedby={`${inputId}-message`}
                />
                <button
                  type="button"
                  className="p-datepicker-trigger p-button p-component p-button-icon-only"
                  aria-label="Choose Date"
                  aria-expanded={isInlineOpen}
                  onClick={() => setIsInlineOpen((currentValue) => !currentValue)}
                >
                  <span className="pi pi-calendar" aria-hidden="true" />
                </button>
              </div>

              {isInlineOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2">
                  <Calendar
                    {...calendarProps}
                    inline
                    showIcon={false}
                    value={normalizeCalendarValue(field.value)}
                    onChange={(event) => field.onChange(event.value ?? null)}
                    onSelect={(event) => {
                      field.onChange(event.value ?? null)
                      field.onBlur()
                      if (!calendarProps.showTime) {
                        setIsInlineOpen(false)
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <Calendar
              {...calendarProps}
              appendTo={typeof document === 'undefined' ? undefined : document.body}
              autoZIndex
              baseZIndex={1200}
              inputId={inputId}
              name={field.name}
              value={normalizeCalendarValue(field.value)}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.value ?? null)}
              onSelect={(event) => field.onChange(event.value ?? null)}
              inputClassName={cn('w-full', fieldState.invalid && 'p-invalid', inputClassName)}
              className={cn('w-full', className)}
              aria-describedby={`${inputId}-message`}
            />
          )}
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
