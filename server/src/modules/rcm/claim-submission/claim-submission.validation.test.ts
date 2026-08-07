import { validate837ProfessionalClaim } from './claim-submission.validation';

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

const validContext = {
  claim: {
    _id: '507f1f77bcf86cd799439011',
    claimType: 'Professional',
    coveragePriority: 'Primary',
    frequencyCode: '1',
    claimDate: new Date('2026-04-30T00:00:00.000Z'),
    totalChargeAmount: 125,
    diagnosisCodes: ['M54.50'],
    claimLines: [
      {
        lineNumber: 1,
        cptCode: '99213',
        modifiers: ['25'],
        icdPointers: [1],
        units: 1,
        chargeAmount: 125,
        placeOfService: '11',
        serviceDateFrom: new Date('2026-04-30T00:00:00.000Z'),
      },
    ],
  },
  patient: {
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
    gender: 'Female',
  },
  insurancePolicy: {
    memberId: 'MEMBER123',
    ediPayerId: '99999',
  },
  payer: {
    payerName: 'Best Payer',
    ediPayerId: '99999',
  },
  billingProvider: {
    firstName: 'Bill',
    lastName: 'Provider',
    npi: '1234567890',
    taxId: '12-3456789',
  },
  renderingProvider: {
    firstName: 'Rita',
    lastName: 'Renderer',
    npi: '1098765432',
    taxonomyCode: '207Q00000X',
  },
  facility: {
    facilityName: 'Downtown Clinic',
    npi: '1231231231',
    taxId: '12-3456789',
    placeOfServiceCode: '11',
    addressLine1: '500 Health Ave',
    city: 'Austin',
    state: 'TX',
    zipCode: '78702',
  },
};

describe('validate837ProfessionalClaim', () => {
  it('returns valid for complete professional claim data', () => {
    const result = validate837ProfessionalClaim(validContext, options);

    expect(result.valid).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('returns structured blocking findings for missing payer and diagnosis pointer data', () => {
    const result = validate837ProfessionalClaim(
      {
        ...validContext,
        insurancePolicy: {
          ...validContext.insurancePolicy,
          ediPayerId: '',
        },
        payer: {
          ...validContext.payer,
          ediPayerId: '',
        },
        claim: {
          ...validContext.claim,
          claimLines: [
            {
              ...validContext.claim.claimLines[0],
              icdPointers: [2],
            },
          ],
        },
      },
      options,
    );

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '837P_PAYER_EDI_ID_REQUIRED',
          fieldPath: 'payer.ediPayerId',
          severity: 'BLOCKING',
        }),
        expect.objectContaining({
          code: '837P_LINE_ICD_POINTER_INVALID',
          fieldPath: 'claim.claimLines.0.icdPointers',
          severity: 'BLOCKING',
        }),
      ]),
    );
  });
});
