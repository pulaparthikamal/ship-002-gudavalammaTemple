import { claimSubmissionIntegrationConfig } from './claim-submission.integration.config';
import { sendClaimSubmission } from './claim-submission.transport';
import {
  claimSubmissionService,
  redactClaimSubmissionPayload,
} from './claim-submission.service';
import { ClaimSubmission } from './claim-submission.model';
import { Claim } from '../claim/claim.model';
import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Patient } from '../patient/patient.model';
import { Provider } from '../provider/provider.model';
import { Facility } from '../facility/facility.model';
import { Payer } from '../payer/payer.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Referral } from '../referral/referral.model';
import { denialWorkflowService } from '../denial/denial-workflow.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { claimRejectionService } from '../claim-rejection/claim-rejection.service';

function chainResolved<T>(value: T) {
  return {
    sort: jest.fn().mockResolvedValue(value),
  };
}

const claimId = '665000000000000000000001';
const patientId = '665000000000000000000002';
const providerId = '665000000000000000000003';
const facilityId = '665000000000000000000004';
const insuranceId = '665000000000000000000005';
const userId = '665000000000000000000006';

function buildClaim(overrides: Record<string, unknown> = {}) {
  return {
    _id: claimId,
    patientId,
    payerId: 'AETNA',
    billingProviderId: providerId,
    renderingProviderId: providerId,
    facilityId,
    claimType: 'Professional',
    coveragePriority: 'Primary',
    frequencyCode: '1',
    claimDate: new Date('2026-05-13T00:00:00.000Z'),
    totalChargeAmount: 125,
    diagnosisCodes: ['M54.50'],
    claimLines: [
      {
        lineNumber: 1,
        cptCode: '99213',
        modifiers: [],
        icdPointers: [1],
        units: 1,
        chargeAmount: 125,
        renderingProviderId: providerId,
        placeOfService: '11',
        serviceDateFrom: new Date('2026-05-13T00:00:00.000Z'),
      },
    ],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockSubmissionContext(claim = buildClaim()) {
  jest.spyOn(Claim, 'findOne').mockResolvedValue(claim as any);
  jest.spyOn(Patient, 'findOne').mockResolvedValue({
    _id: patientId,
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
  } as any);
  jest.spyOn(Provider, 'findOne').mockResolvedValue({
    _id: providerId,
    firstName: 'Rita',
    lastName: 'Renderer',
    npi: '1098765432',
    taxonomyCode: '207Q00000X',
  } as any);
  jest.spyOn(Facility, 'findOne').mockResolvedValue({
    _id: facilityId,
    facilityName: 'Downtown Clinic',
    npi: '1231231231',
    taxId: '12-3456789',
    placeOfServiceCode: '11',
    addressLine1: '500 Health Ave',
    city: 'Austin',
    state: 'TX',
    zipCode: '78702',
  } as any);
  jest.spyOn(InsurancePolicy, 'find').mockReturnValue(chainResolved([
    {
      _id: insuranceId,
      patientId,
      payerId: 'AETNA',
      ediPayerId: '60054',
      memberId: 'MEMBER123',
      coveragePriority: 'Primary',
      relationshipToSubscriber: 'Self',
      subscriber: {},
    },
  ]) as any);
  jest.spyOn(Payer, 'findOne').mockResolvedValue({
    _id: '665000000000000000000007',
    payerId: 'AETNA',
    payerName: 'Aetna',
    ediPayerId: '60054',
    claimsSubmissionMethod: 'Electronic',
  } as any);
  jest.spyOn(PriorAuthorization, 'find').mockResolvedValue([] as any);
  jest.spyOn(Referral, 'find').mockResolvedValue([] as any);
  jest.spyOn(ClaimTracking, 'create').mockResolvedValue({} as any);
}

describe('claimSubmissionService 837P submission hardening', () => {
  const originalEnabled = claimSubmissionIntegrationConfig.enabled;
  const originalSubmitUrl = claimSubmissionIntegrationConfig.request.submitUrl;
  const originalTransportMode = claimSubmissionIntegrationConfig.request.transportMode;
  const originalContactPhone = claimSubmissionIntegrationConfig.request.contactPhone;
  const originalUsageIndicator = claimSubmissionIntegrationConfig.request.usageIndicator;
  const originalStediApiKey = claimSubmissionIntegrationConfig.stedi.apiKey;
  const originalStediSubmitEndpoint = claimSubmissionIntegrationConfig.stedi.submitEndpoint;

  beforeEach(() => {
    jest.restoreAllMocks();
    (claimSubmissionIntegrationConfig as any).enabled = true;
    (claimSubmissionIntegrationConfig.request as any).submitUrl = 'https://clearinghouse.example.test/claims';
    (claimSubmissionIntegrationConfig.request as any).transportMode = 'json';
    (claimSubmissionIntegrationConfig.request as any).contactPhone = '8005551212';
    (claimSubmissionIntegrationConfig.request as any).usageIndicator = 'P';
    (claimSubmissionIntegrationConfig.stedi as any).apiKey = 'test-api-key';
    (claimSubmissionIntegrationConfig.stedi as any).submitEndpoint = 'https://clearinghouse.example.test/stedi-claims';
  });

  afterAll(() => {
    (claimSubmissionIntegrationConfig as any).enabled = originalEnabled;
    (claimSubmissionIntegrationConfig.request as any).submitUrl = originalSubmitUrl;
    (claimSubmissionIntegrationConfig.request as any).transportMode = originalTransportMode;
    (claimSubmissionIntegrationConfig.request as any).contactPhone = originalContactPhone;
    (claimSubmissionIntegrationConfig.request as any).usageIndicator = originalUsageIndicator;
    (claimSubmissionIntegrationConfig.stedi as any).apiKey = originalStediApiKey;
    (claimSubmissionIntegrationConfig.stedi as any).submitEndpoint = originalStediSubmitEndpoint;
  });

  it('missing clearinghouse config fails without fake success', async () => {
    const claim = buildClaim();
    const submissionRecord: any = {
      _id: '665000000000000000000010',
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockSubmissionContext(claim);
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(chainResolved(null) as any);
    jest.spyOn(ClaimSubmission, 'create').mockResolvedValue(submissionRecord as any);
    (claimSubmissionIntegrationConfig as any).enabled = false;

    await expect(
      claimSubmissionService.submitClaim(claimId, 'en', userId)
    ).rejects.toMatchObject({
      message: expect.stringContaining('Claim submission integration is not configured'),
      errors: [expect.objectContaining({ submissionStatus: 'FAILED' })],
    });

    expect(submissionRecord.status).toBe('FAILED');
    expect(submissionRecord.lastError).toContain('Claim submission integration is not configured');
    expect(ClaimSubmission.create).toHaveBeenCalled();
  });

  it('duplicate submit returns existing submission by idempotency key', async () => {
    mockSubmissionContext(buildClaim());
    const existingSubmission = {
      _id: '665000000000000000000011',
      claimId,
      transmissionStatus: 'Transmitted',
      idempotencyKey: 'existing-key',
    };
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(chainResolved(existingSubmission) as any);
    jest.spyOn(ClaimSubmission, 'create').mockResolvedValue({} as any);

    const result = await claimSubmissionService.submitClaim(claimId, 'en', userId);

    expect(result.idempotent).toBe(true);
    expect(result.claimSubmission).toBe(existingSubmission);
    expect(ClaimSubmission.create).not.toHaveBeenCalled();
  });

  it('submits when clearinghouse config is enabled and transport succeeds', async () => {
    const originalFetch = global.fetch;
    const claim = buildClaim();
    const submissionRecord: any = {
      _id: '665000000000000000000012',
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockSubmissionContext(claim);
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(chainResolved(null) as any);
    jest.spyOn(ClaimSubmission, 'create').mockImplementation(async (payload: any) => {
      Object.assign(submissionRecord, payload);
      return submissionRecord;
    });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      text: async () => JSON.stringify({
        submissionId: 'EXT-123',
        batchId: 'BATCH-EXT-123',
        claimControlNumber: 'CTRL-123',
        traceNumber: 'TRACE-123',
        status: 'Transmitted',
        acknowledgementStatus: 'Pending Acknowledgement',
      }),
    });

    try {
      const result = await claimSubmissionService.submitClaim(claimId, 'en', userId);

      expect(result.idempotent).toBe(false);
      expect(result.claimSubmission.externalSubmissionId).toBe('EXT-123');
      expect(result.claimSubmission.externalBatchId).toBe('BATCH-EXT-123');
      expect(result.claimSubmission.controlNumber).toBe('CTRL-123');
      expect(result.claimSubmission.transmissionStatus).toBe('SUBMITTED');
      expect(result.claimSubmission.responseStatusCode).toBe(202);
      expect(result.claimSubmission.requestPayloadRedacted).not.toContain('Jane');
      expect(result.claimSubmission.requestPayloadRedacted).not.toContain('MEMBER123');
      expect(ClaimTracking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          claimId,
          statusCode: 'SUBMITTED',
          clearinghouseTraceNumber: 'TRACE-123',
        })
      );
      expect(claim.save).toHaveBeenCalled();
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  it('transport failure returns a failed submission error instead of success', async () => {
    const originalFetch = global.fetch;
    const claim = buildClaim();
    const submissionRecord: any = {
      _id: '665000000000000000000013',
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockSubmissionContext(claim);
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(chainResolved(null) as any);
    jest.spyOn(ClaimSubmission, 'create').mockImplementation(async (payload: any) => {
      Object.assign(submissionRecord, payload);
      return submissionRecord;
    });
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('clearinghouse timeout'));

    try {
      await expect(
        claimSubmissionService.submitClaim(claimId, 'en', userId)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Claim submission failed: clearinghouse timeout'),
        errors: [expect.objectContaining({ submissionStatus: 'FAILED' })],
      });

      expect(submissionRecord.status).toBe('FAILED');
      expect(submissionRecord.transmissionStatus).toBe('FAILED');
      expect(submissionRecord.lastError).toBe('clearinghouse timeout');
      expect(claim.save).toHaveBeenCalled();
    } finally {
      (global as any).fetch = originalFetch;
    }
  });

  it('stored request payload redaction removes PHI by default', () => {
    const redacted = redactClaimSubmissionPayload(
      'NM1*IL*1*Doe*Jane****MI*MEMBER123~N3*123 Main St~N4*Austin*TX*78701~DMG*D8*19900115*F~SV1*HC:99213*125.00*UN*1***1~'
    );

    expect(redacted).not.toContain('Jane');
    expect(redacted).not.toContain('Doe');
    expect(redacted).not.toContain('MEMBER123');
    expect(redacted).not.toContain('19900115');
    expect(redacted).not.toContain('123 Main St');
    expect(redacted).toContain('[REDACTED]');
  });
});

describe('claim submission transport config', () => {
  const originalEnabled = claimSubmissionIntegrationConfig.enabled;
  const originalSubmitUrl = claimSubmissionIntegrationConfig.request.submitUrl;

  afterEach(() => {
    (claimSubmissionIntegrationConfig as any).enabled = originalEnabled;
    (claimSubmissionIntegrationConfig.request as any).submitUrl = originalSubmitUrl;
  });

  it('missing clearinghouse config fails before transport without fake success', async () => {
    (claimSubmissionIntegrationConfig as any).enabled = false;
    (claimSubmissionIntegrationConfig.request as any).submitUrl = '';

    await expect(
      sendClaimSubmission({
        claimId,
        batchId: 'BATCH-1',
        submissionTraceId: 'TRACE-1',
        idempotencyKey: 'IDEMP-1',
        fileType: '837P',
        payload: 'ISA*00*~',
        metadata: {},
      })
    ).rejects.toThrow('Claim submission integration is not configured');
  });
});

describe('native X12 acknowledgement ingestion', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(denialWorkflowService, 'ensureArWorkItemForRejectedClaim').mockResolvedValue(undefined as any);
    jest.spyOn(claimClosureService, 'syncClaimClosureStatus').mockResolvedValue({} as any);
    jest.spyOn(claimRejectionService, 'createFromSubmission').mockResolvedValue({} as any);
  });

  function mockAcknowledgementPersistence() {
    const submission: any = {
      _id: '665000000000000000000020',
      claimId,
      submissionTraceId: 'TRACE-ACK-1',
      claimControlNumber: 'CTRL-ACK-1',
      trackingSource: 'REAL',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const claim = buildClaim({
      _id: claimId,
      save: jest.fn().mockResolvedValue(undefined),
    });

    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(chainResolved(submission) as any);
    jest.spyOn(Claim, 'findOne').mockResolvedValue(claim as any);
    jest.spyOn(ClaimTracking, 'create').mockResolvedValue({} as any);

    return { submission, claim };
  }

  it('accepts a 999 acknowledgement with AK9 accepted status', async () => {
    const { submission, claim } = mockAcknowledgementPersistence();

    await claimSubmissionService.ingestX12Acknowledgement({
      x12Payload: 'ST*999*0001~AK9*A*1*1*1~SE*3*0001~',
      submissionTraceId: 'TRACE-ACK-1',
      claimControlNumber: 'CTRL-ACK-1',
    }, 'en', userId);

    expect(submission.acknowledgementStatus).toBe('ACCEPTED');
    expect(submission.responseType).toBe('ACK_999');
    expect((claim as any).submissionStatus).toBe('Acknowledged');
    expect((claim as any).closureStatus).toBe('AWAITING_ERA');
    expect((claim as any).expectedEraBy).toBeInstanceOf(Date);
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith(claimId, userId);
    expect(ClaimTracking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: 'ACK_999',
        eventType: 'ACK_999_ACCEPTED',
        normalizedStatus: 'ACCEPTED',
        statusCode: 'A',
      })
    );
  });

  it('persists 277CA STC category, status, and entity codes on rejection', async () => {
    const { submission } = mockAcknowledgementPersistence();

    await claimSubmissionService.ingestX12Acknowledgement({
      x12Payload: 'ST*277*0001~BHT*0085*08*CTRL-ACK-1*20260520*1200~TRN*2*TRACE-ACK-1~STC*R3:21:85*20260520*U~REF*6R*LINE-1~SE*6*0001~',
      submissionTraceId: 'TRACE-ACK-1',
      claimControlNumber: 'CTRL-ACK-1',
    }, 'en', userId);

    expect(submission.acknowledgementStatus).toBe('REJECTED');
    expect(submission.responseType).toBe('ACK_277CA');
    expect(ClaimTracking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: 'ACK_277CA',
        eventType: 'ACK_277CA_REJECTED',
        normalizedStatus: 'REJECTED',
        statusCode: 'R3:21:85',
        stcCategoryCode: 'R3',
        stcStatusCode: '21',
        stcEntityCode: '85',
        affectedServiceLine: 'LINE-1',
        rejectionReasonCodes: expect.arrayContaining(['R3:21:85', 'R3', '21', '85']),
      })
    );
    expect(denialWorkflowService.ensureArWorkItemForRejectedClaim).toHaveBeenCalled();
  });

  it('treats 277CA A3 category as rejected, not accepted', async () => {
    const { submission } = mockAcknowledgementPersistence();

    await claimSubmissionService.ingestX12Acknowledgement({
      x12Payload: 'ST*277*0002~BHT*0085*08*CTRL-ACK-1*20260520*1200~TRN*2*TRACE-ACK-1~STC*A3:21:85*20260520*U~REF*6R*LINE-1~SE*6*0002~',
      submissionTraceId: 'TRACE-ACK-1',
      claimControlNumber: 'CTRL-ACK-1',
    }, 'en', userId);

    expect(submission.acknowledgementStatus).toBe('REJECTED');
    expect(submission.responseType).toBe('ACK_277CA');
    expect(ClaimTracking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: 'ACK_277CA',
        eventType: 'ACK_277CA_REJECTED',
        normalizedStatus: 'REJECTED',
        statusCode: 'A3:21:85',
        stcCategoryCode: 'A3',
        stcStatusCode: '21',
        stcEntityCode: '85',
        affectedServiceLine: 'LINE-1',
      })
    );
    expect(denialWorkflowService.ensureArWorkItemForRejectedClaim).toHaveBeenCalled();
  });
});
