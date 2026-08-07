import { useEffect, useMemo, useRef, useState } from 'react'
import { useController } from 'react-hook-form'
import type { Control, FieldPath, FieldValues, PathValue, UseFormClearErrors, UseFormSetValue } from 'react-hook-form'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteProps } from 'primereact/autocomplete'
import { cn } from '@/utils/classNames'

type AutoCompleteOptionValue = string | number | boolean
type AutoCompleteInputValue = AutoCompleteOption<AutoCompleteOptionValue> | string

export interface AutoCompleteOption<TValue extends AutoCompleteOptionValue = string> {
  label: string
  value: TValue
}

interface CompleteEvent {
  query: string
}

interface FormAutoCompleteProps<TFieldValues extends FieldValues>
  extends Omit<
    AutoCompleteProps<AutoCompleteOption<AutoCompleteOptionValue>>,
    'field' | 'forceSelection' | 'multiple' | 'name' | 'onBlur' | 'onChange' | 'onClear' | 'onSelect' | 'suggestions' | 'value'
  > {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  options?: Array<AutoCompleteOption<AutoCompleteOptionValue>>
  setValue?: UseFormSetValue<TFieldValues>
  clearErrors?: UseFormClearErrors<TFieldValues>
  helperText?: string
  containerClassName?: string
  forceSelection?: boolean
  onSearch?: (
    query: string,
  ) =>
    | Array<AutoCompleteOption<AutoCompleteOptionValue>>
    | Promise<Array<AutoCompleteOption<AutoCompleteOptionValue>>>
}

function isAutoCompleteOption(value: unknown): value is AutoCompleteOption<AutoCompleteOptionValue> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    'value' in value
  )
}

function optionValuesMatch(optionValue: AutoCompleteOptionValue, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return false
  }

  return optionValue === value || String(optionValue) === String(value)
}

function matchesOption(option: AutoCompleteOption<AutoCompleteOptionValue>, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [option.label, String(option.value)].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  )
}

function findOptionByValue(
  value: unknown,
  options: Array<AutoCompleteOption<AutoCompleteOptionValue>>,
) {
  if (isAutoCompleteOption(value)) {
    return value
  }

  return options.find((option) => optionValuesMatch(option.value, value))
}

function findOptionByInput(
  input: string,
  options: Array<AutoCompleteOption<AutoCompleteOptionValue>>,
) {
  const normalizedInput = input.trim().toLowerCase()

  if (!normalizedInput) {
    return undefined
  }

  return options.find((option) => (
    option.label.trim().toLowerCase() === normalizedInput ||
    String(option.value).trim().toLowerCase() === normalizedInput
  ))
}

function resolveSelectedOption(
  value: unknown,
  options: Array<AutoCompleteOption<AutoCompleteOptionValue>>,
): AutoCompleteInputValue {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return findOptionByValue(value, options) ?? String(value)
}

export function FormAutoComplete<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options = [],
  setValue,
  clearErrors,
  helperText,
  containerClassName,
  className,
  inputClassName,
  onSearch,
  dropdown = true,
  forceSelection = true,
  minLength = 0,
  showEmptyMessage = true,
  emptyMessage = 'No results found',
  ...autoCompleteProps
}: FormAutoCompleteProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')
  const [suggestions, setSuggestions] = useState<Array<AutoCompleteOption<AutoCompleteOptionValue>>>([])
  const [isFocused, setIsFocused] = useState(false)
  const blurTimeoutRef = useRef<number | null>(null)
  const {
    field,
    fieldState,
  } = useController({
    control,
    name,
  })
  const selectedInputValue = useMemo(
    () => resolveSelectedOption(field.value, options),
    [field.value, options],
  )
  const [inputValue, setInputValue] = useState<AutoCompleteInputValue>(selectedInputValue)
  const inputValueRef = useRef<AutoCompleteInputValue>(selectedInputValue)

  const updateInputValue = (value: AutoCompleteInputValue) => {
    inputValueRef.current = value
    setInputValue(value)
  }

  const clearPendingBlur = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }

  useEffect(() => {
    if (!isFocused) {
      updateInputValue(selectedInputValue)
    }
  }, [isFocused, selectedInputValue])

  useEffect(() => () => clearPendingBlur(), [])

  const handleComplete = async (event: CompleteEvent) => {
    if (onSearch) {
      setSuggestions(await onSearch(event.query))
      return
    }

    setSuggestions(options.filter((option) => matchesOption(option, event.query)))
  }

  const commitValue = (value: AutoCompleteOptionValue | '') => {
    if (setValue) {
      setValue(
        name,
        value as PathValue<TFieldValues, FieldPath<TFieldValues>>,
        { shouldDirty: true, shouldTouch: true, shouldValidate: false },
      )
      if (value !== '') {
        clearErrors?.(name)
      }
      return
    }

    field.onChange(value)
    if (value !== '') {
      clearErrors?.(name)
    }
  }

  const commitOption = (option: AutoCompleteOption<AutoCompleteOptionValue>) => {
    clearPendingBlur()
    updateInputValue(option)
    commitValue(option.value)
  }

  const handleChange = (value: unknown) => {
    if (isAutoCompleteOption(value)) {
      commitOption(value)
      return
    }

    const nextInput = value === null || value === undefined ? '' : String(value)
    updateInputValue(nextInput)

    if (!forceSelection) {
      commitValue(nextInput)
      return
    }

    if (!nextInput.trim()) {
      commitValue('')
      return
    }

    commitValue('')
  }

  const commitBlurValue = () => {
    setIsFocused(false)
    const currentInputValue = inputValueRef.current

    if (isAutoCompleteOption(currentInputValue)) {
      commitValue(currentInputValue.value)
      return
    }

    const typedValue = currentInputValue.trim()

    if (!typedValue) {
      updateInputValue('')
      commitValue('')
      return
    }

    const matchedOption = findOptionByInput(typedValue, options)

    if (matchedOption) {
      commitOption(matchedOption)
      return
    }

    if (forceSelection) {
      updateInputValue('')
      commitValue('')
      return
    }

    commitValue(typedValue)
  }

  const handleBlur = () => {
    clearPendingBlur()
    blurTimeoutRef.current = window.setTimeout(() => {
      blurTimeoutRef.current = null
      commitBlurValue()
    }, 0)
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
      <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
        {label}
      </label>
      <AutoComplete
        {...autoCompleteProps}
        inputId={inputId}
        name={field.name}
        value={inputValue}
        suggestions={suggestions}
        field="label"
        dropdown={dropdown}
        forceSelection={false}
        minLength={minLength}
        showEmptyMessage={showEmptyMessage}
        emptyMessage={emptyMessage}
        invalid={fieldState.invalid}
        onFocus={() => {
          clearPendingBlur()
          setIsFocused(true)
        }}
        onBlur={handleBlur}
        onChange={(event) => handleChange(event.value)}
        onSelect={(event) => {
          if (isAutoCompleteOption(event.value)) {
            commitOption(event.value)
          }
        }}
        onClear={() => {
          updateInputValue('')
          commitValue('')
        }}
        completeMethod={handleComplete}
        inputClassName={cn('w-full', fieldState.invalid && 'p-invalid', inputClassName)}
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
  )
}
