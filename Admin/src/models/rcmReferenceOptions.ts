import type { CrudSelectOption } from '@/types/crud'

export interface RcmReferenceOptions {
  patients?: CrudSelectOption[]
  insurancePolicies?: CrudSelectOption[]
  appointments?: CrudSelectOption[]
  providers?: CrudSelectOption[]
  facilities?: CrudSelectOption[]
  payers?: CrudSelectOption[]
  chargeMasterCodes?: CrudSelectOption[]
  procedureCodes?: CrudSelectOption[]
  encounters?: CrudSelectOption[]
  charges?: CrudSelectOption[]
  claims?: CrudSelectOption[]
  patientBillings?: CrudSelectOption[]
  arWorkItems?: CrudSelectOption[]
  paymentPostings?: CrudSelectOption[]
}

export function formatReferenceLabel(options: CrudSelectOption[] | undefined, value?: string | number | boolean) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  return options?.find((option) => option.value === value)?.label ?? String(value)
}
