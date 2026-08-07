import {
  ClaimSubmissionValidationFinding,
  ProfessionalClaimValidationRule,
} from './claim-submission.validation';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function payerIdFor(context: Parameters<ProfessionalClaimValidationRule>[0]) {
  return normalizeText(context.insurancePolicy.ediPayerId) || normalizeText(context.payer.ediPayerId);
}

function finding(
  payerId: string,
  code: string,
  fieldPath: string,
  message: string,
  remediation: string,
  options: Partial<ClaimSubmissionValidationFinding> = {}
): ClaimSubmissionValidationFinding {
  return {
    code,
    fieldPath,
    severity: options.severity ?? 'BLOCKING',
    message,
    remediation,
    payerId,
    source: 'PAYER_COMPANION_GUIDE',
    loop: options.loop,
    segment: options.segment,
  };
}

const aetnaValidator: ProfessionalClaimValidationRule = (context) => {
  const payerId = payerIdFor(context);
  const findings: ClaimSubmissionValidationFinding[] = [];

  if (!normalizeText(context.billingProvider.taxonomyCode || context.renderingProvider.taxonomyCode)) {
    findings.push(finding(
      payerId,
      'AETNA_BILLING_TAXONOMY_REQUIRED',
      'billingProvider.taxonomyCode',
      'Aetna companion-guide validation requires billing/rendering taxonomy on professional claims.',
      'Add provider taxonomy before claim readiness/submission.',
      { loop: '2000A/2310B', segment: 'PRV' },
    ));
  }

  context.claim.claimLines.forEach((line, index) => {
    if (normalizeText(line.placeOfService) === '02' && !normalizeText(line.modifiers?.[0])) {
      findings.push(finding(
        payerId,
        'AETNA_TELEHEALTH_MODIFIER_REQUIRED',
        `claim.claimLines.${index}.modifiers`,
        'Aetna test rule requires a telehealth modifier when POS 02 is used.',
        'Add payer-required telehealth modifier or correct the place of service.',
        { segment: 'SV101-3' },
      ));
    }
  });

  return findings;
};

const bcbsValidator: ProfessionalClaimValidationRule = (context) => {
  const payerId = payerIdFor(context);
  const findings: ClaimSubmissionValidationFinding[] = [];

  context.claim.claimLines.forEach((line, index) => {
    const pos = normalizeText(line.placeOfService);
    if (pos && !['11', '22', '02', '10'].includes(pos)) {
      findings.push(finding(
        payerId,
        'BCBS_POS_NOT_ALLOWED_FOR_TEST_RULE',
        `claim.claimLines.${index}.placeOfService`,
        `BCBS test companion rule allows POS 11, 22, 02, or 10. Received ${pos}.`,
        'Correct POS or configure a payer-specific exception.',
        { segment: 'SV105' },
      ));
    }
  });

  return findings;
};

const stediTestPayerValidator: ProfessionalClaimValidationRule = (context, options) => {
  const payerId = payerIdFor(context);
  const findings: ClaimSubmissionValidationFinding[] = [];

  if (options.usageIndicator === 'T' && !payerId) {
    findings.push(finding(
      payerId,
      'STEDI_TEST_PAYER_ID_REQUIRED',
      'payer.ediPayerId',
      'Stedi test submissions require a configured test payer ID in Loop 2010BB NM109.',
      'Set STEDI_TEST_PAYER_ID or payer/insurance EDI payer ID for test claims.',
      { loop: '2010BB', segment: 'NM1*PR' },
    ));
  }

  if (options.usageIndicator === 'T' && options.claimControlNumber.length > 20) {
    findings.push(finding(
      payerId,
      'STEDI_CLM01_TOO_LONG',
      'options.claimControlNumber',
      'Stedi test validator requires CLM01 to fit within the 20-character patient control number limit.',
      'Shorten the claim control number/correlation key before submission.',
      { segment: 'CLM01' },
    ));
  }

  return findings;
};

const registry: Array<{ matcher: RegExp; rule: ProfessionalClaimValidationRule }> = [
  { matcher: /^(60054|AETNA|AET)/i, rule: aetnaValidator },
  { matcher: /^(BCBS|BLUE|SB|ANTHEM)/i, rule: bcbsValidator },
  { matcher: /^(STEDI|TEST|TST|9496|99999)/i, rule: stediTestPayerValidator },
];

export function getPayerSpecific837PValidators(
  context: Parameters<ProfessionalClaimValidationRule>[0]
): ProfessionalClaimValidationRule[] {
  const candidates = [
    context.insurancePolicy.ediPayerId,
    context.insurancePolicy.payerId,
    context.payer.ediPayerId,
    context.payer.payerName,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return registry
    .filter((entry) => candidates.some((candidate) => entry.matcher.test(candidate)))
    .map((entry) => entry.rule);
}
