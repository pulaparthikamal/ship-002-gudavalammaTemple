import { build837ProfessionalClaimPayload } from './claim-submission.edi';

describe('build837ProfessionalClaimPayload', () => {
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

  const context = {
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
          serviceDateTo: new Date('2026-04-30T00:00:00.000Z'),
        },
      ],
    },
    patient: {
      medicalRecordNumber: 'MRN-123',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      gender: 'Female',
      address: {
        addressLine1: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
      },
    },
    insurancePolicy: {
      memberId: 'MEMBER123',
      relationshipToSubscriber: 'Self',
      planName: 'Commercial PPO',
      payerId: 'PAYER01',
      ediPayerId: '99999',
      subscriber: {},
    },
    payer: {
      payerName: 'Best Payer',
      ediPayerId: '99999',
    },
    billingProvider: {
      firstName: 'Bill',
      lastName: 'Provider',
      npi: '1234567890',
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

  it('builds an 837P payload with expected core segments', () => {
    const result = build837ProfessionalClaimPayload(context, options);

    expect(result.fileType).toBe('837P');
    expect(result.claimControlNumber).toBe('CLMCONTROL01');
    expect(result.payload).toContain('ISA*00*');
    expect(result.payload).toContain('GS*HC*');
    expect(result.payload).toContain('ST*837*1234*005010X222A1');
    expect(result.payload).toContain('CLM*CLMCONTROL01*125.00');
    expect(result.payload).toContain('HI*ABK:M5450');
    expect(result.payload).toContain('SV1*HC:99213:25*125.00*UN*1***1');
    expect(result.payload).toContain('SE*');
    expect(result.payload.endsWith('~')).toBe(true);
  });

  it('blocks missing payer EDI payer ID required for 837P build', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        {
          ...context,
          insurancePolicy: {
            ...context.insurancePolicy,
            ediPayerId: '',
          },
          payer: {
            ...context.payer,
            ediPayerId: '',
          },
        },
        options
      )
    ).toThrow('EDI payer ID is required for electronic claim submission.');
  });

  it('blocks missing billing provider NPI required for 837P build', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        {
          ...context,
          billingProvider: {
            ...context.billingProvider,
            npi: '',
          },
        },
        options
      )
    ).toThrow('Billing provider NPI is required for electronic claim submission.');
  });

  it('blocks missing billing/rendering taxonomy required for 837P build', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        {
          ...context,
          billingProvider: {
            ...context.billingProvider,
            taxonomyCode: '',
          },
          renderingProvider: {
            ...context.renderingProvider,
            taxonomyCode: '',
          },
        },
        options
      )
    ).toThrow('Billing or rendering provider taxonomy code is required for electronic claim submission.');
  });

  it('blocks missing submitter contact phone required for 837P build', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        context,
        {
          ...options,
          contactPhone: '',
        }
      )
    ).toThrow('Submitter contact phone is required for electronic claim submission.');
  });

  it('blocks missing facility POS required for 837P build', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        {
          ...context,
          facility: {
            ...context.facility,
            placeOfServiceCode: '',
          },
        },
        options
      )
    ).toThrow('Facility place of service is required for electronic claim submission.');
  });

  it('blocks missing diagnosis pointers required for 837P build', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        {
          ...context,
          claim: {
            ...context.claim,
            claimLines: [
              {
                ...context.claim.claimLines[0],
                icdPointers: [],
              },
            ],
          },
        },
        options
      )
    ).toThrow('diagnosis pointers are required for electronic claim submission.');
  });

  it('includes linked authorization and referral numbers when required', () => {
    const result = build837ProfessionalClaimPayload(
      {
        ...context,
        claim: {
          ...context.claim,
          claimLines: [
            {
              ...context.claim.claimLines[0],
              authorizationRequired: true,
              referralRequired: true,
              priorAuthorizationNumber: 'AUTH-123',
              referralNumber: 'REF-456',
            },
          ],
        },
      },
      options
    );

    expect(result.payload).toContain('REF*G1*AUTH-123');
    expect(result.payload).toContain('REF*9F*REF-456');
  });

  it('rejects missing member data required for electronic submission', () => {
    expect(() =>
      build837ProfessionalClaimPayload(
        {
          ...context,
          insurancePolicy: {
            ...context.insurancePolicy,
            memberId: '',
          },
        },
        options
      )
    ).toThrow('Subscriber/member ID is required for electronic claim submission.');
  });
});
