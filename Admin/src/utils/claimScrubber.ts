/**
 * Claim Scrubber Utility
 *
 * Provides pre-submission validation of a Claim object.
 * Rules are grouped by category (patient, insurance, coding, billing, financial)
 * and are designed to be modular and extensible.
 *
 * Usage:
 *   import { claimScrubber } from '@/utils/claimScrubber'
 *   const { errors, warnings, claimQualityScore, autoFixSuggestions } = claimScrubber(claim)
 */

import type { Claim } from '@/types/claim'
import { icd10CodePattern, cptCodePattern } from '@/models/rcmValidation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScrubIssueType = 'error' | 'warning'

export interface ScrubIssue {
  type: ScrubIssueType
  field: string
  message: string
  autoFix?: string
}

export interface ScrubResult {
  errors: ScrubIssue[]
  warnings: ScrubIssue[]
  /** 0–100. Starts at 100 and is penalised for each issue. */
  claimQualityScore: number
  /** Simple one-liner suggestions mapped by field name. */
  autoFixSuggestions: Record<string, string>
}

// ---------------------------------------------------------------------------
// Mock data (replace with config-driven / AI-powered rules in the future)
// ---------------------------------------------------------------------------

// MOCK: CPT codes that are commonly mismatched with certain ICD-10 prefixes.
// Key = CPT code, Value = set of ICD-10 prefixes that are compatible.
const CPT_ICD_COMPATIBILITY_MAP: Record<string, string[]> = {
  '99213': ['Z00', 'J06', 'J00', 'J45', 'I10', 'E11', 'M54', 'R05', 'K21'],
  '99214': ['Z00', 'J06', 'J00', 'J45', 'I10', 'E11', 'M54', 'R05', 'K21'],
  '93000': ['I10', 'I25', 'I48', 'Z87', 'R00', 'Z13'],
  '71046': ['J18', 'J22', 'J80', 'R05', 'R91'],
  '85025': ['D64', 'D50', 'D69', 'R70', 'Z00'],
}

// MOCK: Inactive payer IDs — replace with a real coverage lookup.
const KNOWN_INACTIVE_PAYER_IDS = new Set<string>(['PAYER-INACTIVE-001', 'PAYER-INACTIVE-002'])

// MOCK: Invalid policy number pattern — policies must be alphanumeric 6–20 chars.
const POLICY_NUMBER_PATTERN = /^[A-Z0-9]{6,20}$/i

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function addError(errors: ScrubIssue[], field: string, message: string, autoFix?: string) {
  errors.push({ type: 'error', field, message, ...(autoFix ? { autoFix } : {}) })
}

function addWarning(warnings: ScrubIssue[], field: string, message: string, autoFix?: string) {
  warnings.push({ type: 'warning', field, message, ...(autoFix ? { autoFix } : {}) })
}

function isFutureDate(value: string | Date | undefined): boolean {
  if (!value) return false
  const d = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(d.getTime()) && d > new Date()
}

function normalizeCode(code: string | undefined): string {
  return (code ?? '').trim().toUpperCase()
}

// ---------------------------------------------------------------------------
// Rule groups
// ---------------------------------------------------------------------------

/**
 * PATIENT rules
 * Note: The Claim type stores patientId (a reference), not inline patient
 * demographics. Full DOB / gender checks require patient lookup data, which
 * is outside the scope of the synchronous scrubber. We validate presence only.
 */
function validatePatient(claim: Claim, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  if (!claim.patientId?.trim()) {
    addError(errors, 'patientId', 'Patient is required.', 'Select a patient from the claim header.')
  }

  // If encounter is linked we treat it as a proxy for a complete patient record.
  if (!claim.encounterId?.trim()) {
    addWarning(warnings, 'encounterId', 'No encounter is linked to this claim. Verify patient demographics are complete.')
  }
}

/**
 * INSURANCE rules
 */
function validateInsurance(claim: Claim, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  if (!claim.payerId?.trim()) {
    addError(errors, 'payerId', 'Payer is required.', 'Select a payer from the claim header.')
    return
  }

  // MOCK: Inactive coverage check using known inactive payer IDs.
  if (KNOWN_INACTIVE_PAYER_IDS.has(claim.payerId.trim())) {
    addError(
      errors,
      'payerId',
      `Payer "${claim.payerId}" has inactive coverage. Verify the patient's insurance policy.`,
    )
  }

  // Policy number format warning (claimId is used as a proxy for policy # here;
  // replace with actual insurancePolicyNumber field if available on the claim).
  const policyRef = claim.claimId ?? ''
  if (policyRef && !POLICY_NUMBER_PATTERN.test(policyRef.trim())) {
    addWarning(
      warnings,
      'claimId',
      `Claim reference number "${policyRef}" does not match the expected policy number format (6–20 alphanumeric characters).`,
    )
  }
}

/**
 * CODING rules
 */
function validateCoding(claim: Claim, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  const diagnosisCodes = (claim.diagnosisCodes ?? []).map(normalizeCode).filter(Boolean)

  // ICD-10 format validation
  if (diagnosisCodes.length === 0) {
    addError(errors, 'diagnosisCodes', 'At least one diagnosis (ICD-10) code is required.', 'Add diagnosis codes in the Claim Header section.')
  } else {
    const invalidIcds = diagnosisCodes.filter((code) => !icd10CodePattern.test(code))
    if (invalidIcds.length > 0) {
      addError(
        errors,
        'diagnosisCodes',
        `Invalid ICD-10 code(s): ${invalidIcds.join(', ')}. Codes must follow the format A00–Z99 with optional decimal.`,
        'Correct the diagnosis codes to valid ICD-10 format (e.g. J45.901, I10).',
      )
    }
  }

  const nonEmptyLines = (claim.claimLines ?? []).filter(
    (line) => line.cptCode?.trim() || line.chargeAmount != null,
  )

  // Missing CPT
  if (nonEmptyLines.length === 0) {
    addError(errors, 'claimLines', 'No service lines found. At least one claim line with a CPT code is required.')
    return
  }

  const seenCptCodes = new Map<string, number>()

  nonEmptyLines.forEach((line, idx) => {
    const lineLabel = `Line ${(line.lineNumber ?? idx + 1)}`
    const cpt = normalizeCode(line.cptCode)

    if (!cpt) {
      addError(errors, `claimLines[${idx}].cptCode`, `${lineLabel}: CPT/HCPCS code is required.`)
    } else if (!cptCodePattern.test(cpt)) {
      addError(
        errors,
        `claimLines[${idx}].cptCode`,
        `${lineLabel}: "${cpt}" is not a valid CPT/HCPCS code (must be 5 characters, e.g. 99213).`,
      )
    } else {
      // Duplicate CPT check
      const prevIdx = seenCptCodes.get(cpt)
      if (prevIdx !== undefined) {
        addWarning(
          warnings,
          `claimLines[${idx}].cptCode`,
          `${lineLabel}: CPT code "${cpt}" is duplicated (also on Line ${prevIdx + 1}). Confirm this is intentional.`,
        )
      } else {
        seenCptCodes.set(cpt, idx)
      }

      // CPT–ICD mismatch check (MOCK map)
      const compatibleIcdPrefixes = CPT_ICD_COMPATIBILITY_MAP[cpt]
      if (compatibleIcdPrefixes && diagnosisCodes.length > 0) {
        const hasCompatible = diagnosisCodes.some((icd) =>
          compatibleIcdPrefixes.some((prefix) => icd.startsWith(prefix)),
        )
        if (!hasCompatible) {
          addWarning(
            warnings,
            `claimLines[${idx}].cptCode`,
            `${lineLabel}: CPT "${cpt}" may not be compatible with the provided diagnosis codes. Verify medical necessity.`,
          )
        }
      }
    }
  })
}

/**
 * BILLING rules
 * NPI digit validation is intentionally skipped here: the Claim stores provider
 * IDs (MongoDB references), not NPI numbers directly. NPI format is enforced
 * on the Provider record itself. We validate provider ID presence only.
 */
function validateBilling(claim: Claim, errors: ScrubIssue[]) {
  if (!claim.billingProviderId?.trim()) {
    addError(errors, 'billingProviderId', 'Billing provider is required.', 'Select a billing provider in the Claim Header.')
  }

  if (!claim.renderingProviderId?.trim()) {
    addError(errors, 'renderingProviderId', 'Rendering provider is required.', 'Select a rendering provider in the Claim Header.')
  }

  if (!claim.facilityId?.trim()) {
    addError(errors, 'facilityId', 'Facility is required.', 'Select a facility in the Claim Header.')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nonEmptyLines = (claim.claimLines ?? []).filter(
    (line) => line.cptCode?.trim() || line.chargeAmount != null,
  )

  nonEmptyLines.forEach((line, idx) => {
    const lineLabel = `Line ${line.lineNumber ?? idx + 1}`

    if (!line.serviceDateFrom) {
      addError(
        errors,
        `claimLines[${idx}].serviceDateFrom`,
        `${lineLabel}: Service date (from) is required.`,
        `Enter the date of service for ${lineLabel}.`,
      )
    } else if (isFutureDate(line.serviceDateFrom)) {
      addError(
        errors,
        `claimLines[${idx}].serviceDateFrom`,
        `${lineLabel}: Service date "${new Date(line.serviceDateFrom).toLocaleDateString()}" is in the future. Service must have already occurred.`,
      )
    }
  })
}

/**
 * FINANCIAL rules
 */
function validateFinancial(claim: Claim, errors: ScrubIssue[]) {
  const total = claim.totalChargeAmount

  if (total == null || total <= 0) {
    addError(
      errors,
      'totalChargeAmount',
      total == null
        ? 'Total charge amount is required.'
        : `Total charge amount must be greater than $0 (currently $${total.toFixed(2)}).`,
      'Enter a positive total charge amount in the Claim Header.',
    )
  }

  const nonEmptyLines = (claim.claimLines ?? []).filter(
    (line) => line.cptCode?.trim() || line.chargeAmount != null,
  )

  let lineSum = 0

  nonEmptyLines.forEach((line, idx) => {
    const lineLabel = `Line ${line.lineNumber ?? idx + 1}`
    const amount = line.chargeAmount

    if (amount == null || amount <= 0) {
      addError(
        errors,
        `claimLines[${idx}].chargeAmount`,
        `${lineLabel}: Charge amount must be greater than $0 (currently ${amount == null ? 'missing' : `$${amount.toFixed(2)}`}).`,
        `Enter a valid positive charge amount for ${lineLabel}.`,
      )
    } else {
      lineSum += amount
    }
  })

  if (
    total != null &&
    total > 0 &&
    nonEmptyLines.length > 0 &&
    Math.abs(lineSum - total) > 0.01
  ) {
    addError(
      errors,
      'totalChargeAmount',
      `Total charge amount ($${total.toFixed(2)}) does not match the sum of claim line charges ($${lineSum.toFixed(2)}). Difference: $${Math.abs(lineSum - total).toFixed(2)}.`,
      `Update the total charge amount to $${lineSum.toFixed(2)} to match the sum of line charges.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Main scrubber entry point
// ---------------------------------------------------------------------------

/**
 * Runs all validation rules against a Claim object.
 * Returns errors, warnings, a quality score (0–100), and auto-fix suggestions.
 *
 * ERRORS block submission.
 * WARNINGS require user confirmation before proceeding.
 */
export function claimScrubber(claim: Claim): ScrubResult {
  const errors: ScrubIssue[] = []
  const warnings: ScrubIssue[] = []

  validatePatient(claim, errors, warnings)
  validateInsurance(claim, errors, warnings)
  validateCoding(claim, errors, warnings)
  validateBilling(claim, errors)
  validateFinancial(claim, errors)

  // Quality score: start at 100, deduct 10 per error, 3 per warning, min 0.
  const claimQualityScore = Math.max(0, 100 - errors.length * 10 - warnings.length * 3)

  // Collect all auto-fix suggestions keyed by field name.
  const autoFixSuggestions: Record<string, string> = {}
  for (const issue of [...errors, ...warnings]) {
    if (issue.autoFix) {
      autoFixSuggestions[issue.field] = issue.autoFix
    }
  }

  return { errors, warnings, claimQualityScore, autoFixSuggestions }
}
