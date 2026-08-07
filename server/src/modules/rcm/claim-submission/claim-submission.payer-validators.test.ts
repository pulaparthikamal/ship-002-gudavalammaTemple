import { getPayerSpecific837PValidators } from './claim-submission.payer-validators';

const baseContext = {
  claim: {
    _id: '507f1f77bcf86cd799439011',
    claimType: 'Professional',
    frequencyCode: '1',
    diagnosisCodes: ['M54.50'],
    claimLines: [
      {
        lineNumber: 1,
        cptCode: '99213',
        icdPointers: [1],
        units: 1,
        chargeAmount: 125,
        placeOfService: '02',
        serviceDateFrom: new Date('2026-04-30T00:00:00.000Z'),
      },
    ],
  },
  patient: {},
  insurancePolicy: {
    memberId: 'MEMBER123',
    ediPayerId: 'AETNA',
  },
  payer: {
    payerName: 'Aetna',
    ediPayerId: 'AETNA',
  },
  billingProvider: {
    npi: '1234567890',
    taxId: '123456789',
  },
  renderingProvider: {
    npi: '1098765432',
  },
  facility: {
    npi: '1231231231',
  },
};

const options = {
  senderId: 'SENDER01',
  receiverId: 'RECEIVER01',
  submitterId: 'SUBMITTER1',
  submitterName: 'Realtime RCM',
  receiverName: 'Clearinghouse',
  contactName: 'RCM Support',
  contactPhone: '8005551212',
  usageIndicator: 'T',
  interchangeControlNumber: '123456789',
  groupControlNumber: '123456789',
  transactionSetControlNumber: '1234',
  claimControlNumber: 'CLMCONTROL01',
};

describe('payer-specific 837P validators', () => {
  it('selects Aetna rules and returns companion-guide findings', () => {
    const validators = getPayerSpecific837PValidators(baseContext as any);
    const findings = validators.flatMap((validator) => validator(baseContext as any, options));

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AETNA_BILLING_TAXONOMY_REQUIRED',
          source: 'PAYER_COMPANION_GUIDE',
          payerId: 'AETNA',
        }),
        expect.objectContaining({
          code: 'AETNA_TELEHEALTH_MODIFIER_REQUIRED',
          source: 'PAYER_COMPANION_GUIDE',
          payerId: 'AETNA',
        }),
      ]),
    );
  });

  it('selects BCBS rules by payer name or payer ID', () => {
    const context = {
      ...baseContext,
      insurancePolicy: {
        ...baseContext.insurancePolicy,
        ediPayerId: 'BCBS',
      },
      payer: {
        payerName: 'BCBS Test',
        ediPayerId: 'BCBS',
      },
      claim: {
        ...baseContext.claim,
        claimLines: [
          {
            ...baseContext.claim.claimLines[0],
            placeOfService: '99',
          },
        ],
      },
    };

    const validators = getPayerSpecific837PValidators(context as any);
    const findings = validators.flatMap((validator) => validator(context as any, options));

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'BCBS_POS_NOT_ALLOWED_FOR_TEST_RULE',
          source: 'PAYER_COMPANION_GUIDE',
          payerId: 'BCBS',
        }),
      ]),
    );
  });
});
