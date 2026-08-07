import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

interface FormLocalFileProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  disabled?: boolean
  containerClassName?: string
  accept?: string
}

export function FormLocalFile<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  disabled,
  containerClassName,
  accept,
}: FormLocalFileProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={containerClassName}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            {label}
          </label>
          <input
            ref={field.ref}
            name={field.name}
            type="file"
            accept={accept}
            disabled={disabled}
            className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white disabled:opacity-60"
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
          />
          {(field.value as unknown) instanceof File ? (
            <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">{field.value.name}</p>
          ) : null}
          {helperText ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helperText}</p> : null}
          {fieldState.error?.message ? (
            <p className="mt-1 text-xs font-semibold text-[var(--color-danger-text)]">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  )
}
