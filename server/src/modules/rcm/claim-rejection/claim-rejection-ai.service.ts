type ClaimRejectionAiInput = {
  rejectionCode?: string;
  rejectionReason?: string;
  cptCodes?: string[];
  icdCodes?: string[];
  payer?: Record<string, unknown>;
  provider?: Record<string, unknown>;
};

export type ClaimRejectionAiSuggestion = {
  rootCause: string;
  suggestion: string;
  confidence: number;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function includesAny(value: string, tokens: string[]) {
  const normalizedValue = value.toLowerCase();
  return tokens.some((token) => normalizedValue.includes(token));
}

export const claimRejectionAiService = {
  async analyze(input: ClaimRejectionAiInput): Promise<ClaimRejectionAiSuggestion> {
    const reason = normalizeText(input.rejectionReason);
    const code = normalizeText(input.rejectionCode).toUpperCase();
    const text = `${code} ${reason}`.toLowerCase();

    if (includesAny(text, ['diagnosis', 'icd', 'invalid dx', 'principal diagnosis'])) {
      return {
        rootCause: 'Invalid or unsupported diagnosis coding',
        suggestion: 'Validate ICD-10 codes, diagnosis pointer order, and payer policy for the submitted service date.',
        confidence: 92,
      };
    }

    if (includesAny(text, ['procedure', 'cpt', 'hcpcs', 'service line'])) {
      return {
        rootCause: 'Procedure code or service line mismatch',
        suggestion: 'Review CPT/HCPCS codes, units, service dates, and payer-specific billing rules before resubmission.',
        confidence: 88,
      };
    }

    if (includesAny(text, ['modifier', 'mod'])) {
      return {
        rootCause: 'Missing or invalid modifier',
        suggestion: 'Add the required modifier or remove unsupported modifiers according to payer policy.',
        confidence: 86,
      };
    }

    if (includesAny(text, ['member', 'subscriber', 'eligibility', 'coverage', 'patient'])) {
      return {
        rootCause: 'Subscriber or eligibility data mismatch',
        suggestion: 'Verify member ID, payer, coverage priority, patient demographics, and eligibility for the date of service.',
        confidence: 84,
      };
    }

    if (includesAny(text, ['provider', 'npi', 'taxonomy', 'tax id', 'ein'])) {
      return {
        rootCause: 'Provider enrollment or identifier issue',
        suggestion: 'Confirm billing/rendering provider NPI, taxonomy, Tax ID, and payer enrollment information.',
        confidence: 82,
      };
    }

    if (includesAny(text, ['attachment', 'documentation', 'medical record', 'note'])) {
      return {
        rootCause: 'Missing supporting documentation',
        suggestion: 'Attach the requested clinical documentation or payer-required attachment before resubmission.',
        confidence: 80,
      };
    }

    return {
      rootCause: 'Payer acknowledgement requires manual review',
      suggestion: 'Compare the rejection code and payer message against claim demographics, diagnosis, CPT, modifiers, provider data, and attachments.',
      confidence: input.cptCodes?.length || input.icdCodes?.length ? 72 : 64,
    };
  },
};
