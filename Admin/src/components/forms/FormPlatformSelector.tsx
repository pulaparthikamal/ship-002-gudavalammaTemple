import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { MultiSelect } from 'primereact/multiselect'
import { cn } from '@/utils/classNames'
import { useGetPlatformsQuery } from '@/services/api/endpoints/platformsApi'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { normalizePlatformValue } from '@/utils/platformValue'
import type { EntityId } from '@/types/common'

const platformSelectorStyles = `
  .platform-selector .p-multiselect-label {
    padding: 0.5rem 0.75rem;
  }
  .platform-selector .p-multiselect-token {
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: 9999px;
  }
`

interface FormPlatformSelectorProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  placeholder?: string
  containerClassName?: string
}

interface PlatformOption {
  label: string
  value: string
  id: EntityId
  icon?: string
  svg?: string
  color?: string
}


export function FormPlatformSelector<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  placeholder,
  containerClassName,
}: FormPlatformSelectorProps<TFieldValues>) {
  const { data: platforms = [], isLoading } = useGetPlatformsQuery()

  const options = platforms.map(p => ({ 
      label: p.name, 
      value: normalizePlatformValue(p.name), 
      id: p._id,
      icon: p.icon,
      svg: p.svg,
      color: p.color
    }))

  const itemTemplate = (option: PlatformOption) => (
    <div className="flex items-center gap-3 w-full py-1">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden border border-[var(--color-border)] bg-white shadow-sm">
         <PlatformIcon icon={option.icon} svg={option.svg} color={option.color} size="1.25rem" />
      </div>
      <span className="text-sm font-medium text-neutral-700">{option.label}</span>
    </div>
  )

  const selectedItemTemplate = (value: unknown) => {
    const option = typeof value === 'string'
      ? options.find(item => item.value === value)
      : value && typeof value === 'object' && 'value' in value
        ? value as PlatformOption
        : undefined
    
    if (option) {
      return (
        <div className="flex items-center gap-2 mr-2">
          <PlatformIcon icon={option.icon} svg={option.svg} color={option.color} size="0.75rem" />
          <span className="text-xs font-medium">{option.label}</span>
        </div>
      )
    }
    return typeof value === 'string' ? value : null
  }

  return (
    <>
      <style>{platformSelectorStyles}</style>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
            <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={name.replaceAll('.', '-')}>
              {label}
            </label>
            <MultiSelect
              id={name.replaceAll('.', '-')}
              value={field.value}
              options={options}
              onChange={(e) => field.onChange(e.value)}
              placeholder={placeholder ?? 'Select platforms'}
              className={cn('w-full platform-selector', fieldState.invalid && 'p-invalid')}
              itemTemplate={itemTemplate}
              selectedItemTemplate={selectedItemTemplate}
              display="chip"
              filter
              loading={isLoading}
              emptyMessage="No platforms found."
            />
            {fieldState.error && (
              <p className="text-xs text-red-600 font-medium px-0.5">{fieldState.error.message}</p>
            )}
            {helperText && !fieldState.error && (
               <p className="text-xs text-[var(--color-text-muted)] px-0.5">{helperText}</p>
            )}
          </div>
        )}
      />
    </>
  )
}
