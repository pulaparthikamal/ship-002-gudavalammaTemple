export const phonePattern = /^\+?[0-9().\-\s]{10,20}$/
export const zipCodePattern = /^\d{5}(?:-\d{4})?$/
export const stateCodePattern = /^[A-Za-z]{2}$/
export const npiPattern = /^\d{10}$/
export const taxIdPattern = /^\d{2}-?\d{7}$/
export const placeOfServicePattern = /^\d{2}$/
export const cptCodePattern = /^[A-Z0-9]{5}$/i
export const icd10CodePattern = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i
export const serviceTypeCodePattern = /^[A-Z0-9]{1,3}$/i
export const taxonomyCodePattern = /^\d{10}[A-Z]$/

export function splitMultiValueText(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function hasAnyText(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0)
}

export function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function isNonNegativeNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
