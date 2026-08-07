type AcknowledgementRemediationInput = {
  acknowledgementType?: string;
  acknowledgementStatus?: string;
  statusCode?: string;
  statusDescription?: string;
  rejectionReasonCodes?: string[];
  stcCategoryCode?: string;
  stcStatusCode?: string;
  stcEntityCode?: string;
  affectedServiceLine?: string;
};

export type AcknowledgementRemediation = {
  readinessCode: string;
  fieldPath: string;
  severity: 'BLOCKING' | 'WARNING';
  message: string;
  nextActionRequired: string;
  serviceLineReference?: string;
};

const STC_CATEGORY_REMEDIATION: Record<string, Pick<AcknowledgementRemediation, 'readinessCode' | 'fieldPath' | 'message' | 'nextActionRequired'>> = {
  A1: {
    readinessCode: 'ACK277_ACKNOWLEDGEMENT_REJECTED',
    fieldPath: 'claim.submission',
    message: '277CA rejected the claim acknowledgement.',
    nextActionRequired: 'Review 277CA STC rejection details, correct the claim, and resubmit.',
  },
  A3: {
    readinessCode: 'ACK277_CLAIM_REJECTED',
    fieldPath: 'claim.submission',
    message: '277CA rejected the claim at payer/clearinghouse level.',
    nextActionRequired: 'Correct claim-level payer/clearinghouse defects and resubmit.',
  },
  A7: {
    readinessCode: 'ACK277_ENTITY_OR_SUBSCRIBER_REJECTED',
    fieldPath: 'insurancePolicy',
    message: '277CA rejection indicates patient, subscriber, provider, or payer entity data is invalid.',
    nextActionRequired: 'Correct entity demographics, member ID, payer ID, or provider identifiers and resubmit.',
  },
  A8: {
    readinessCode: 'ACK277_SERVICE_LINE_REJECTED',
    fieldPath: 'claim.claimLines',
    message: '277CA rejected one or more service lines.',
    nextActionRequired: 'Correct service-line procedure, diagnosis pointer, date, unit, or charge defects and resubmit.',
  },
};

const STC_STATUS_REMEDIATION: Record<string, Pick<AcknowledgementRemediation, 'readinessCode' | 'fieldPath' | 'message' | 'nextActionRequired'>> = {
  21: {
    readinessCode: 'ACK277_MISSING_INFORMATION',
    fieldPath: 'claim.readiness',
    message: 'Acknowledgement indicates required information is missing.',
    nextActionRequired: 'Review missing required information and rerun claim readiness.',
  },
  85: {
    readinessCode: 'ACK277_ENTITY_INFORMATION_INVALID',
    fieldPath: 'insurancePolicy',
    message: 'Acknowledgement indicates subscriber/member or entity information is invalid.',
    nextActionRequired: 'Verify patient, subscriber/member, payer, and provider identifiers.',
  },
  562: {
    readinessCode: 'ACK277_ENTITY_IDENTIFIER_INVALID',
    fieldPath: 'payer.ediPayerId',
    message: 'Acknowledgement indicates an entity identifier is invalid.',
    nextActionRequired: 'Verify payer EDI ID, provider NPI, tax ID, and submitter/receiver identifiers.',
  },
};

const ACK999_REMEDIATION: Pick<AcknowledgementRemediation, 'readinessCode' | 'fieldPath' | 'message' | 'nextActionRequired'> = {
  readinessCode: 'ACK999_X12_SYNTAX_REJECTED',
  fieldPath: 'claim.edi837',
  message: '999 rejected the 837 transaction for X12 syntax or implementation-guide errors.',
  nextActionRequired: 'Correct 837P syntax/implementation-guide errors before resubmission.',
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function mapAcknowledgementToRemediation(input: AcknowledgementRemediationInput): AcknowledgementRemediation | undefined {
  const status = normalizeText(input.acknowledgementStatus);
  if (status !== 'REJECTED') {
    return undefined;
  }

  const acknowledgementType = normalizeText(input.acknowledgementType);
  const categoryRemediation = STC_CATEGORY_REMEDIATION[normalizeText(input.stcCategoryCode)];
  const statusRemediation = STC_STATUS_REMEDIATION[normalizeText(input.stcStatusCode)];
  const base = categoryRemediation ?? statusRemediation ?? (acknowledgementType.includes('999') ? ACK999_REMEDIATION : undefined);

  if (!base) {
    return {
      readinessCode: 'ACK_REJECTION_REQUIRES_REVIEW',
      fieldPath: input.affectedServiceLine ? 'claim.claimLines' : 'claim.submission',
      severity: 'BLOCKING',
      message: input.statusDescription || 'Acknowledgement rejected the claim and requires manual remediation.',
      nextActionRequired: 'Review acknowledgement rejection details, correct the claim, and resubmit.',
      serviceLineReference: input.affectedServiceLine,
    };
  }

  return {
    ...base,
    severity: 'BLOCKING',
    serviceLineReference: input.affectedServiceLine,
    message: input.statusDescription ? `${base.message} ${input.statusDescription}` : base.message,
  };
}
