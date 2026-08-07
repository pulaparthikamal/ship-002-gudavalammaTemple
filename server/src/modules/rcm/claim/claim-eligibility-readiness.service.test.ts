import { claimService } from './claim.service';
import { envConfig } from '../../../config/env.config';
import { EligibilityVerification } from '../eligibility-verification/eligibility-verification.model';
import { Facility } from '../facility/facility.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Payer } from '../payer/payer.model';
import { Provider } from '../provider/provider.model';
import { Patient } from '../patient/patient.model';
import { eligibilityVerificationService } from '../eligibility-verification/eligibility-verification.service';
import { ProcedureCode } from '../procedure-code/procedure-code.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Referral } from '../referral/referral.model';
import { Charge } from '../charge/charge.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { claimAiReviewService } from '../claim-ai-review/claim-ai-review.service';
import { claimSubmissionService } from '../claim-submission/claim-submission.service';
import { claimSubmissionIntegrationConfig } from '../claim-submission/claim-submission.integration.config';
import { DocumentationComplianceAlert } from '../documentation-compliance-alert/documentation-compliance-alert.model';
import { Document } from '../document/document.model';
import { Encounter } from '../encounter/encounter.model';
import { TimelyFilingAlert } from '../timely-filing-alert/timely-filing-alert.model';

const patientId = '665000000000000000000001';
const insuranceId = '665000000000000000000002';
const payerId = 'AETNA';
const serviceDate = new Date();

function chainResolved<T>(value: T) {
  return {
    sort: jest.fn().mockResolvedValue(value),
  };
}

function chainSessionLeanResolved<T>(value: T) {
  return {
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function chainSortSelectSessionLeanResolved<T>(value: T) {
  return {
    sort: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function chainSessionResolved<T>(value: T) {
  const promise = Promise.resolve(value);
  return {
    session: jest.fn().mockResolvedValue(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

function buildClaim(overrides: Record<string, unknown> = {}) {
  return {
    _id: '665000000000000000000010',
    claimId: 'CLM-TEST',
    chargeId: '665000000000000000000011',
    encounterId: '665000000000000000000012',
    patientId,
    payerId,
    billingProviderId: '665000000000000000000020',
    renderingProviderId: '665000000000000000000021',
    facilityId: '665000000000000000000030',
    claimDate: serviceDate,
    totalChargeAmount: 160,
    coveragePriority: 'Primary',
    frequencyCode: '1',
    claimType: 'Professional',
    claimStatus: 'Ready for Submission',
    scrubStatus: 'Passed',
    submissionStatus: 'Not Submitted',
    diagnosisCodes: ['I10'],
    correctedClaimIndicator: false,
    sourceChargeUpdatedAt: serviceDate,
    sourceCodingReviewUpdatedAt: serviceDate,
    sourceCodingSnapshotHash: 'TEST-SNAPSHOT',
    claimLines: [
      {
        _id: '665000000000000000000040',
        lineNumber: 1,
        cptCode: '99213',
        modifiers: [],
        icdPointers: [1],
        units: 1,
        chargeAmount: 160,
        placeOfService: '11',
        serviceDateFrom: serviceDate,
        expectedAllowedAmount: 110,
        expectedPatientResponsibility: 25,
        expectedInsurancePayment: 85,
        feeScheduleId: '665000000000000000000050',
        pricingMatchedBy: 'payer-provider-cpt-state-pos',
        authorizationRequired: false,
        referralRequired: false,
      },
    ],
    ...overrides,
  };
}

function buildPolicy(overrides: Record<string, unknown> = {}) {
  return {
    _id: insuranceId,
    patientId,
    payerId,
    ediPayerId: '60054',
    coveragePriority: 'Primary',
    coverageType: 'PRIMARY',
    planName: 'Aetna PPO',
    memberId: 'M123',
    policyStatus: 'Active',
    network: 'IN_NETWORK',
    effectiveDate: new Date('2025-01-01'),
    ...overrides,
  };
}

function buildEligibility(overrides: Record<string, unknown> = {}) {
  return {
    _id: '665000000000000000000060',
    patientId,
    insuranceId,
    payerId,
    serviceTypeCode: '30',
    serviceDate,
    coveragePriority: 'Primary',
    procedureCodes: ['99213'],
    eligibilityStatus: 'Eligible',
    coverageStatus: 'Active',
    planActive: true,
    checkedAt: new Date(),
    active: true,
    isDeleted: false,
    ...overrides,
  };
}

function buildAuthorization(overrides: Record<string, unknown> = {}) {
  return {
    _id: '665000000000000000000070',
    patientId,
    insuranceId,
    payerId,
    providerId: '665000000000000000000021',
    facilityId: '665000000000000000000030',
    serviceDate,
    procedureCodes: ['99213'],
    authNumber: 'AUTH-123',
    authorizationStatus: 'Approved',
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    active: true,
    isDeleted: false,
    ...overrides,
  };
}

function buildReferral(overrides: Record<string, unknown> = {}) {
  return {
    _id: '665000000000000000000080',
    patientId,
    insuranceId,
    payerId,
    facilityId: '665000000000000000000030',
    referredToProviderId: '665000000000000000000021',
    procedureCodes: ['99213'],
    referralNumber: 'REF-123',
    referralStatus: 'Approved',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    remainingVisits: 3,
    active: true,
    isDeleted: false,
    ...overrides,
  };
}

function mockReadinessDependencies(eligibilities: any[], claimOverrides: Record<string, unknown> = {}) {
  jest.spyOn(claimService, 'getById').mockResolvedValue(buildClaim(claimOverrides) as any);
  jest.spyOn(InsurancePolicy, 'find').mockReturnValue(chainResolved([buildPolicy()]) as any);
  const payer = {
    payerId,
    payerName: 'Aetna',
    ediPayerId: '60054',
    claimsSubmissionMethod: 'Electronic',
    active: true,
  };
  jest.spyOn(Payer, 'findOne').mockReturnValue(chainSessionResolved(payer) as any);
  jest.spyOn(Patient, 'findOne').mockResolvedValue({
    _id: patientId,
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Female',
    address: {
      addressLine1: '100 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    },
    active: true,
  } as any);
  jest.spyOn(Facility, 'findOne').mockResolvedValue({
    _id: '665000000000000000000030',
    facilityName: 'Texas Clinic',
    npi: '1234567890',
    taxId: '111223333',
    placeOfServiceCode: '11',
    addressLine1: '200 Clinic Dr',
    city: 'Austin',
    state: 'TX',
    zipCode: '78702',
    active: true,
  } as any);
  jest.spyOn(Provider, 'findOne').mockResolvedValue({
    _id: '665000000000000000000021',
    firstName: 'Provider',
    lastName: 'A',
    npi: '1098765432',
    taxonomyCode: '207Q00000X',
    active: true,
  } as any);
  jest.spyOn(EligibilityVerification, 'find').mockReturnValue(chainResolved(eligibilities) as any);
  jest.spyOn(Charge, 'findOne').mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '665000000000000000000011',
        updated: serviceDate,
      }),
    }),
  } as any);
  jest.spyOn(CodingReview, 'findOne').mockReturnValue({
    sort: jest.fn().mockResolvedValue({
      _id: '665000000000000000000013',
      chargeId: '665000000000000000000011',
      scrubStatus: 'Approved',
      updated: serviceDate,
      approvedCodingSnapshot: {
        snapshotHash: 'TEST-SNAPSHOT',
        lines: [
          {
            lineNumber: 1,
            chargeLineId: '665000000000000000000040',
            cptCode: '99213',
            modifiers: [],
            icdCodes: ['I10'],
            icdPointers: [1],
            units: 1,
            chargeAmount: 160,
            placeOfService: '11',
            renderingProviderId: '665000000000000000000021',
            serviceDateFrom: serviceDate,
          },
        ],
      },
    }),
  } as any);
  jest.spyOn(ProcedureCode, 'exists').mockResolvedValue(null as any);
  jest.spyOn(ProcedureCode, 'find').mockReturnValue(chainSessionLeanResolved([]) as any);
  jest.spyOn(ProcedureCode, 'findOne').mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  } as any);
  jest.spyOn(Document, 'find').mockReturnValue({
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  } as any);
  jest.spyOn(Encounter, 'findOne').mockReturnValue({
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(null),
  } as any);
  jest.spyOn(PriorAuthorization, 'find').mockReturnValue(chainSortSelectSessionLeanResolved([]) as any);
  jest.spyOn(PriorAuthorization, 'findOne').mockResolvedValue(null as any);
  jest.spyOn(Referral, 'find').mockReturnValue(chainResolved([]) as any);
  jest.spyOn(Referral, 'findOne').mockResolvedValue(null as any);
  jest.spyOn(DocumentationComplianceAlert, 'findOne').mockReturnValue({
    session: jest.fn().mockResolvedValue(null),
  } as any);
  jest.spyOn(DocumentationComplianceAlert, 'findOneAndUpdate').mockResolvedValue({
    _id: '665000000000000000000090',
    claimId: '665000000000000000000010',
    status: 'FAIL',
  } as any);
  jest.spyOn(DocumentationComplianceAlert, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as any);
  jest.spyOn(DocumentationComplianceAlert, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as any);
  jest.spyOn(TimelyFilingAlert, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as any);
}

describe('claimService eligibility readiness', () => {
  const originalSubmissionEnabled = claimSubmissionIntegrationConfig.enabled;
  const originalStediApiKey = claimSubmissionIntegrationConfig.stedi.apiKey;
  const originalStediSubmitEndpoint = claimSubmissionIntegrationConfig.stedi.submitEndpoint;
  const originalDocumentationComplianceZapierEnabled = envConfig.rcmZapierDocumentationComplianceEnabled;

  beforeEach(() => {
    (claimSubmissionIntegrationConfig as any).enabled = true;
    (claimSubmissionIntegrationConfig.stedi as any).apiKey = 'test-api-key';
    (claimSubmissionIntegrationConfig.stedi as any).submitEndpoint = 'https://clearinghouse.example.test/stedi-claims';
    (envConfig as any).rcmZapierDocumentationComplianceEnabled = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    (claimSubmissionIntegrationConfig as any).enabled = originalSubmissionEnabled;
    (claimSubmissionIntegrationConfig.stedi as any).apiKey = originalStediApiKey;
    (claimSubmissionIntegrationConfig.stedi as any).submitEndpoint = originalStediSubmitEndpoint;
    (envConfig as any).rcmZapierDocumentationComplianceEnabled = originalDocumentationComplianceZapierEnabled;
  });

  it('blocks readiness when eligibility is missing', async () => {
    mockReadinessDependencies([]);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.canSubmit).toBe(false);
    expect(result.errors).toContain('Claim line 1: Eligibility verification is missing.');
  });

  it('blocks readiness when eligibility is expired', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 10);
    mockReadinessDependencies([buildEligibility({ checkedAt: expiredDate })]);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.canSubmit).toBe(false);
    expect(result.errors).toContain('Claim line 1: Eligibility verification is older than 7 days.');
  });

  it('blocks readiness when coverage is inactive', async () => {
    mockReadinessDependencies([
      buildEligibility({
        planActive: false,
        coverageStatus: 'Inactive',
        eligibilityStatus: 'Ineligible',
      }),
    ]);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.canSubmit).toBe(false);
    expect(result.errors).toContain('Claim line 1: Patient coverage is inactive for date of service.');
  });

  it('passes the eligibility portion when fresh active eligibility exists', async () => {
    mockReadinessDependencies([buildEligibility()]);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.errors.filter((error) => error.includes('Eligibility'))).toHaveLength(0);
  });

  it('blocks readiness when claim frequency code is missing', async () => {
    mockReadinessDependencies([buildEligibility()], { frequencyCode: undefined });

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.canSubmit).toBe(false);
    expect(result.errors).toContain('Claim frequency code is required for electronic claim submission.');
  });

  it('blocks readiness when coverage rule snapshot contains blocking errors', async () => {
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [
        {
          ...buildClaim().claimLines[0],
          coverageRuleSnapshot: {
            coverageRules: {
              covered: false,
              errors: ['Service is not covered by matched coverage rule.'],
              warnings: [],
              matchedRules: [{ ruleType: 'NOT_COVERED' }],
            },
          },
        },
      ],
    });

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.canSubmit).toBe(false);
    expect(result.errors).toContain('Claim line 1: Service is not covered by matched coverage rule.');
    expect(result.requiredActions).toContain('Resolve coverage rule failures for CPT 99213.');
  });

  it('keeps readiness validation in parity with 837P build required fields', async () => {
    mockReadinessDependencies([buildEligibility()], {
      frequencyCode: undefined,
      claimLines: [
        {
          ...buildClaim().claimLines[0],
          placeOfService: '',
          serviceDateFrom: undefined,
          units: 0,
          chargeAmount: 0,
          icdPointers: [2],
        },
      ],
    });
    (InsurancePolicy.find as jest.Mock).mockReturnValue(chainResolved([buildPolicy({ ediPayerId: '' })]) as any);
    (Payer.findOne as jest.Mock).mockReturnValue(chainSessionResolved({
      payerId,
      payerName: '',
      ediPayerId: '',
      claimsSubmissionMethod: 'Electronic',
      active: true,
    }) as any);
    (Patient.findOne as jest.Mock).mockResolvedValue({
      _id: patientId,
      firstName: '',
      lastName: '',
      dateOfBirth: undefined,
      gender: '',
      address: {},
      active: true,
    });
    (Facility.findOne as jest.Mock).mockResolvedValue({
      _id: '665000000000000000000030',
      facilityName: '',
      npi: '',
      taxId: '',
      placeOfServiceCode: '',
      active: true,
    });
    (Provider.findOne as jest.Mock).mockResolvedValue({
      _id: '665000000000000000000021',
      npi: '',
      lastName: '',
      active: true,
    });

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.canSubmit).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Patient first name is required for electronic claim submission.',
      'Patient last name is required for electronic claim submission.',
      'Patient date of birth is required for electronic claim submission.',
      'Patient gender/sex is required for electronic claim submission.',
      'Patient address is required for electronic claim submission.',
      'Payer name is required for electronic claim submission.',
      'Electronic claim submission requires an EDI payer ID.',
      'Billing provider NPI is required for electronic claim submission.',
      'Billing or rendering provider taxonomy code is required for electronic claim submission.',
      'Rendering provider NPI is required.',
      'Rendering provider last name is required for electronic claim submission.',
      'Facility name is required for electronic claim submission.',
      'Facility NPI is required.',
      'Billing provider Tax ID is required for electronic claim submission.',
      'Facility place of service is required for electronic claim submission.',
      'Facility address is required for electronic claim submission.',
      'Claim frequency code is required for electronic claim submission.',
      'Claim line 1 must include valid units.',
      'Claim line 1 must include a valid charge amount.',
      'Claim line 1 is missing place of service.',
      'Claim line 1 is missing service date.',
      'Claim line 1 includes diagnosis pointers outside the claim diagnosis list.',
    ]));
  });

  it('returns integration configuration error when claim eligibility run is not configured', async () => {
    jest.spyOn(claimService, 'getById').mockResolvedValue(buildClaim() as any);
    jest.spyOn(InsurancePolicy, 'find').mockReturnValue(chainResolved([buildPolicy()]) as any);
    jest
      .spyOn(eligibilityVerificationService, 'runRealtimeVerification')
      .mockRejectedValue(new Error('Eligibility integration is not configured for this environment.'));

    await expect(
      claimService.runEligibility('665000000000000000000010', 'en', '665000000000000000000099')
    ).rejects.toThrow('Eligibility integration is not configured for this environment.');
  });

  it('blocks readiness when authorization is required but missing', async () => {
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], authorizationRequired: true }],
    });

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.authorizationRequired).toBe(true);
    expect(result.authorizationValid).toBe(false);
    expect(result.authorizationErrors).toContain('Claim line 1: Authorization is required but no authorization is linked to the claim line.');
  });

  it('passes readiness authorization checks when valid authorization exists', async () => {
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], authorizationRequired: true }],
    });
    (PriorAuthorization.find as jest.Mock).mockReturnValue(chainSortSelectSessionLeanResolved([buildAuthorization()]) as any);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.authorizationRequired).toBe(true);
    expect(result.authorizationValid).toBe(true);
    expect(result.authorizationErrors).toEqual([]);
  });

  it('blocks readiness when linked authorization is expired', async () => {
    const expiredAuthorization = buildAuthorization({
      _id: '665000000000000000000071',
      expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], authorizationRequired: true, priorAuthorizationId: expiredAuthorization._id }],
    });
    (PriorAuthorization.findOne as jest.Mock).mockResolvedValue(expiredAuthorization);
    (PriorAuthorization.find as jest.Mock).mockReturnValue(chainSortSelectSessionLeanResolved([expiredAuthorization]) as any);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.authorizationValid).toBe(false);
    expect(result.authorizationErrors?.some((error) => error.includes('Authorization is expired'))).toBe(true);
  });

  it('blocks readiness when linked authorization is denied', async () => {
    const deniedAuthorization = buildAuthorization({
      _id: '665000000000000000000072',
      authorizationStatus: 'Denied',
    });
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], authorizationRequired: true, priorAuthorizationId: deniedAuthorization._id }],
    });
    (PriorAuthorization.findOne as jest.Mock).mockResolvedValue(deniedAuthorization);
    (PriorAuthorization.find as jest.Mock).mockReturnValue(chainSortSelectSessionLeanResolved([deniedAuthorization]) as any);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.authorizationValid).toBe(false);
    expect(result.authorizationErrors?.some((error) => error.includes('Authorization status is not approved'))).toBe(true);
  });

  it('blocks readiness when referral is required but missing', async () => {
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], referralRequired: true }],
    });

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.referralRequired).toBe(true);
    expect(result.referralValid).toBe(false);
    expect(result.referralErrors).toContain('Claim line 1: Referral is required but no referral is linked to the claim line.');
  });

  it('passes readiness referral checks when valid referral exists', async () => {
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], referralRequired: true }],
    });
    (Referral.find as jest.Mock).mockReturnValue(chainResolved([buildReferral()]) as any);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.referralRequired).toBe(true);
    expect(result.referralValid).toBe(true);
    expect(result.referralErrors).toEqual([]);
  });

  it('blocks readiness when linked referral mismatches payer, facility, or CPT', async () => {
    const mismatchedReferral = buildReferral({
      _id: '665000000000000000000081',
      payerId: 'BCBS',
      facilityId: '665000000000000000000099',
      procedureCodes: ['99214'],
    });
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], referralRequired: true, referralId: mismatchedReferral._id }],
    });
    (Referral.findOne as jest.Mock).mockResolvedValue(mismatchedReferral);
    (Referral.find as jest.Mock).mockReturnValue(chainResolved([mismatchedReferral]) as any);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.referralValid).toBe(false);
    expect(result.referralErrors?.some((error) => error.includes('Referral payer does not match claim payer'))).toBe(true);
    expect(result.referralErrors?.some((error) => error.includes('Referral facility does not match claim facility'))).toBe(true);
    expect(result.referralErrors?.some((error) => error.includes('Referral does not include CPT 99213'))).toBe(true);
  });

  it('blocks readiness when linked authorization mismatches payer, policy, or CPT', async () => {
    const mismatchedAuthorization = buildAuthorization({
      _id: '665000000000000000000073',
      payerId: 'BCBS',
      insuranceId: '665000000000000000000099',
      procedureCodes: ['99214'],
    });
    mockReadinessDependencies([buildEligibility()], {
      claimLines: [{ ...buildClaim().claimLines[0], authorizationRequired: true, priorAuthorizationId: mismatchedAuthorization._id }],
    });
    (PriorAuthorization.findOne as jest.Mock).mockResolvedValue(mismatchedAuthorization);
    (PriorAuthorization.find as jest.Mock).mockReturnValue(chainSortSelectSessionLeanResolved([mismatchedAuthorization]) as any);

    const result = await claimService.getReadiness('665000000000000000000010', 'en');

    expect(result.authorizationValid).toBe(false);
    expect(result.authorizationErrors?.some((error) => error.includes('Authorization payer does not match claim payer'))).toBe(true);
    expect(result.authorizationErrors?.some((error) => error.includes('Authorization policy does not match active insurance policy'))).toBe(true);
    expect(result.authorizationErrors?.some((error) => error.includes('Authorization does not include CPT 99213'))).toBe(true);
  });

  it('does not let AI review block deterministic claim submission', async () => {
    const claim = buildClaim({
      save: jest.fn().mockResolvedValue(undefined),
    }) as any;
    mockReadinessDependencies([buildEligibility()], claim);
    jest.spyOn(claimSubmissionService, 'getLatestForClaim').mockResolvedValue(null as any);
    jest.spyOn(claimAiReviewService, 'runPreSubmissionReview').mockResolvedValue({
      denialPrediction: {
        reviewRequired: true,
        predictedReasons: ['AI advisory denial risk'],
      },
      blockingReasons: ['AI advisory only'],
    } as any);
    jest.spyOn(claimSubmissionService, 'submitClaim').mockResolvedValue({
      claimSubmission: {
        _id: '665000000000000000000090',
        externalSubmissionId: 'EXT-1',
        controlNumber: 'CTRL-1',
        transmissionStatus: 'Transmitted',
      },
    } as any);

    const result = await claimService.submit('665000000000000000000010', 'en', '665000000000000000000099');

    expect(claimSubmissionService.submitClaim).toHaveBeenCalled();
    expect(result.claimSubmissionId).toBe('665000000000000000000090');
  }, 15000);
});
