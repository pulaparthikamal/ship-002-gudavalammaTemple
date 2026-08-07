/**
 * Server-side Advisory Claim Scrubber
 *
 * Pure validation logic — no database access.
 * Mirrors the frontend claimScrubber.ts rules for user guidance only.
 * This mock scrubber is advisory and must not be used as the authority for
 * claim submission. Deterministic readiness + EDI builder validation decide
 * whether a claim may submit.
 *
 * Usage:
 *   import { claimScrubber } from './claim.scrubber'
 *   const result = claimScrubber(claimDocument)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScrubIssueType = 'error' | 'warning';

export interface ScrubIssue {
  type: ScrubIssueType;
  field: string;
  message: string;
  autoFix?: string;
}

export interface ScrubResult {
  errors: ScrubIssue[];
  warnings: ScrubIssue[];
  /** 0–100. Starts at 100 and is penalised for each issue. */
  claimQualityScore: number;
  /** Simple one-liner fix suggestions keyed by field name. */
  autoFixSuggestions: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Regex patterns (must match frontend rcmValidation.ts)
// ---------------------------------------------------------------------------

const icd10CodePattern = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i;
const cptCodePattern = /^[A-Z0-9]{5}$/i;

// ---------------------------------------------------------------------------
// Advisory mock data
// ---------------------------------------------------------------------------

// ADVISORY MOCK: CPT–ICD compatibility map (does not block submission)
const CPT_ICD_COMPATIBILITY_MAP: Record<string, string[]> = {
  '99213': ['Z00', 'J06', 'J00', 'J45', 'I10', 'E11', 'M54', 'R05', 'K21'],
  '99214': ['Z00', 'J06', 'J00', 'J45', 'I10', 'E11', 'M54', 'R05', 'K21'],
  '93000': ['I10', 'I25', 'I48', 'Z87', 'R00', 'Z13'],
  '71046': ['J18', 'J22', 'J80', 'R05', 'R91'],
  '85025': ['D64', 'D50', 'D69', 'R70', 'Z00'],
};

// ADVISORY MOCK: Known inactive payer IDs (does not block submission)
const KNOWN_INACTIVE_PAYER_IDS = new Set<string>(['PAYER-INACTIVE-001', 'PAYER-INACTIVE-002']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addError(errors: ScrubIssue[], field: string, message: string, autoFix?: string) {
  errors.push({ type: 'error', field, message, ...(autoFix ? { autoFix } : {}) });
}

function addWarning(warnings: ScrubIssue[], field: string, message: string, autoFix?: string) {
  warnings.push({ type: 'warning', field, message, ...(autoFix ? { autoFix } : {}) });
}

function isFutureDate(value: unknown): boolean {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value as string);
  return !Number.isNaN(d.getTime()) && d > new Date();
}

function normalizeCode(value: unknown): string {
  return (typeof value === 'string' ? value : '').trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Rule groups
// ---------------------------------------------------------------------------

function validatePatient(claim: any, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  if (!claim.patientId) {
    addError(errors, 'patientId', 'Patient is required.', 'Assign a patient to the claim.');
  }

  if (!claim.encounterId) {
    addWarning(
      warnings,
      'encounterId',
      'No encounter linked to this claim. Verify patient demographics are complete.',
    );
  }
}

function validateInsurance(claim: any, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  if (!claim.payerId) {
    addError(errors, 'payerId', 'Payer is required.', 'Assign a payer to the claim.');
    return;
  }

  // MOCK: Inactive coverage check
  if (KNOWN_INACTIVE_PAYER_IDS.has(String(claim.payerId).trim())) {
    addError(
      errors,
      'payerId',
      `Payer "${claim.payerId}" has inactive coverage. Verify the patient's insurance policy.`,
    );
  }
}

function validateCoding(claim: any, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  const diagnosisCodes: string[] = (claim.diagnosisCodes ?? []).map(normalizeCode).filter(Boolean);

  if (diagnosisCodes.length === 0) {
    addError(
      errors,
      'diagnosisCodes',
      'At least one diagnosis (ICD-10) code is required.',
      'Add diagnosis codes to the claim.',
    );
  } else {
    const invalidIcds = diagnosisCodes.filter((code) => !icd10CodePattern.test(code));
    if (invalidIcds.length > 0) {
      addError(
        errors,
        'diagnosisCodes',
        `Invalid ICD-10 code(s): ${invalidIcds.join(', ')}. Codes must follow the format A00–Z99 with optional decimal.`,
        'Correct diagnosis codes to valid ICD-10 format.',
      );
    }
  }

  const claimLines: any[] = (claim.claimLines ?? []).filter(
    (line: any) => line.cptCode || line.chargeAmount != null,
  );

  if (claimLines.length === 0) {
    addError(errors, 'claimLines', 'No service lines found. At least one claim line with a CPT code is required.');
    return;
  }

  const seenCptCodes = new Map<string, number>();

  claimLines.forEach((line: any, idx: number) => {
    const lineLabel = `Line ${line.lineNumber ?? idx + 1}`;
    const cpt = normalizeCode(line.cptCode);

    if (!cpt) {
      addError(errors, `claimLines[${idx}].cptCode`, `${lineLabel}: CPT/HCPCS code is required.`);
    } else if (!cptCodePattern.test(cpt)) {
      addError(
        errors,
        `claimLines[${idx}].cptCode`,
        `${lineLabel}: "${cpt}" is not a valid CPT/HCPCS code (must be 5 characters).`,
      );
    } else {
      const prevIdx = seenCptCodes.get(cpt);
      if (prevIdx !== undefined) {
        addWarning(
          warnings,
          `claimLines[${idx}].cptCode`,
          `${lineLabel}: CPT code "${cpt}" is duplicated (also on Line ${prevIdx + 1}). Confirm this is intentional.`,
        );
      } else {
        seenCptCodes.set(cpt, idx);
      }

      // CPT–ICD mismatch (MOCK)
      const compatiblePrefixes = CPT_ICD_COMPATIBILITY_MAP[cpt];
      if (compatiblePrefixes && diagnosisCodes.length > 0) {
        const hasCompatible = diagnosisCodes.some((icd) =>
          compatiblePrefixes.some((prefix) => icd.startsWith(prefix)),
        );
        if (!hasCompatible) {
          addWarning(
            warnings,
            `claimLines[${idx}].cptCode`,
            `${lineLabel}: CPT "${cpt}" may not be compatible with the provided diagnosis codes. Verify medical necessity.`,
          );
        }
      }
    }
  });
}

function validateBilling(claim: any, errors: ScrubIssue[], warnings: ScrubIssue[]) {
  if (!claim.billingProviderId) {
    addError(errors, 'billingProviderId', 'Billing provider is required.', 'Assign a billing provider to the claim.');
  }

  if (!claim.renderingProviderId) {
    addError(errors, 'renderingProviderId', 'Rendering provider is required.', 'Assign a rendering provider to the claim.');
  }

  if (!claim.facilityId) {
    addError(errors, 'facilityId', 'Facility is required.', 'Assign a facility to the claim.');
  }

  const claimLines: any[] = (claim.claimLines ?? []).filter(
    (line: any) => line.cptCode || line.chargeAmount != null,
  );

  claimLines.forEach((line: any, idx: number) => {
    const lineLabel = `Line ${line.lineNumber ?? idx + 1}`;

    if (!line.serviceDateFrom) {
      addError(
        errors,
        `claimLines[${idx}].serviceDateFrom`,
        `${lineLabel}: Service date (from) is required.`,
        `Enter the date of service for ${lineLabel}.`,
      );
    } else if (isFutureDate(line.serviceDateFrom)) {
      addError(
        errors,
        `claimLines[${idx}].serviceDateFrom`,
        `${lineLabel}: Service date is in the future. Service must have already occurred.`,
      );
    }
  });
}

function validateFinancial(claim: any, errors: ScrubIssue[], _warnings: ScrubIssue[]) {
  const total = typeof claim.totalChargeAmount === 'number' ? claim.totalChargeAmount : null;

  if (total == null || total <= 0) {
    addError(
      errors,
      'totalChargeAmount',
      total == null
        ? 'Total charge amount is required.'
        : `Total charge amount must be greater than $0 (currently $${total.toFixed(2)}).`,
      'Enter a positive total charge amount.',
    );
  }

  const claimLines: any[] = (claim.claimLines ?? []).filter(
    (line: any) => line.cptCode || line.chargeAmount != null,
  );

  let lineSum = 0;

  claimLines.forEach((line: any, idx: number) => {
    const lineLabel = `Line ${line.lineNumber ?? idx + 1}`;
    const amount = typeof line.chargeAmount === 'number' ? line.chargeAmount : null;

    if (amount == null || amount <= 0) {
      addError(
        errors,
        `claimLines[${idx}].chargeAmount`,
        `${lineLabel}: Charge amount must be greater than $0 (currently ${amount == null ? 'missing' : `$${amount.toFixed(2)}`}).`,
        `Enter a valid positive charge amount for ${lineLabel}.`,
      );
    } else {
      lineSum += amount;
    }
  });

  if (
    total != null &&
    total > 0 &&
    claimLines.length > 0 &&
    Math.abs(lineSum - total) > 0.01
  ) {
    addError(
      errors,
      'totalChargeAmount',
      `Total charge amount ($${total.toFixed(2)}) does not match the sum of claim line charges ($${lineSum.toFixed(2)}). Difference: $${Math.abs(lineSum - total).toFixed(2)}.`,
      `Update the total charge amount to $${lineSum.toFixed(2)} to match the sum of line charges.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs all scrub validation rules against a claim document.
 * Accepts a Mongoose document or a plain object shaped like a Claim.
 */
export function claimScrubber(claim: any): ScrubResult {
  const errors: ScrubIssue[] = [];
  const warnings: ScrubIssue[] = [];

  validatePatient(claim, errors, warnings);
  validateInsurance(claim, errors, warnings);
  validateCoding(claim, errors, warnings);
  validateBilling(claim, errors, warnings);
  validateFinancial(claim, errors, warnings);

  const claimQualityScore = Math.max(0, 100 - errors.length * 10 - warnings.length * 3);

  const autoFixSuggestions: Record<string, string> = {};
  for (const issue of [...errors, ...warnings]) {
    if (issue.autoFix) {
      autoFixSuggestions[issue.field] = issue.autoFix;
    }
  }

  return { errors, warnings, claimQualityScore, autoFixSuggestions };
}
