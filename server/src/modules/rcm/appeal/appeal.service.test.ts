import { appealService } from './appeal.service';
import { Appeal } from './appeal.model';
import { AppealPayerRule } from './appeal-payer-rule.model';
import { Claim } from '../claim/claim.model';
import { Denial } from '../denial/denial.model';
import mongoose from 'mongoose';
import { promises as fs } from 'fs';

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

jest.mock('../background-job/rcm-queue.service', () => ({
  registerRcmJobHandler: jest.fn(),
}));

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../workflow/rcm-ai.service', () => ({
  rcmAiService: {},
}));

jest.mock('../audit-log/audit-log.service', () => ({
  auditLogService: {
    record: jest.fn().mockResolvedValue({}),
  },
}));

function queryResolved(value: any) {
  return { session: jest.fn().mockResolvedValue(value) };
}

function readinessReadyAppeal(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'appeal-1',
    denialId: 'denial-1',
    claimId: 'claim-1',
    payerId: '60054',
    appealStatus: 'READY',
    generatedAppealLetterText: 'Please reconsider this medically necessary service.',
    supportingDocumentsMetadata: [
      {
        documentId: 'doc-1',
        documentType: 'MEDICAL_RECORDS',
        fileName: 'medical-records.pdf',
        fileReference: '/api/v1/uploads/rcm/appeal-documents/medical-records.pdf',
        status: 'ACTIVE',
      },
    ],
    correspondenceHistory: [],
    active: true,
    isDeleted: false,
    ...overrides,
  } as any;
}

describe('appealService submit readiness', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the submission channel supplied by the submit action payload during readiness validation', async () => {
    jest.spyOn(Appeal, 'findOne').mockResolvedValue(readinessReadyAppeal());
    jest.spyOn(Claim, 'findOne').mockResolvedValue({
      _id: 'claim-1',
      payerId: '60054',
      billingProviderId: 'provider-1',
      claimLines: [{ cptCode: 'D5110' }],
    } as any);
    jest.spyOn(Denial, 'findOne').mockResolvedValue({
      _id: 'denial-1',
      payerId: '60054',
      denialReason: 'Medical necessity',
    } as any);
    jest.spyOn(AppealPayerRule, 'findOne').mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    } as any);
    const changeStatusSpy = jest.spyOn(appealService, 'changeStatus').mockResolvedValue(readinessReadyAppeal({ appealStatus: 'SUBMITTED' }));

    await appealService.submit('appeal-1', {
      reason: 'Submitted from UI work queue.',
      submissionMethod: 'PORTAL',
    }, 'en', 'user-1');

    expect(changeStatusSpy).toHaveBeenCalledWith(
      'appeal-1',
      expect.objectContaining({
        appealStatus: 'SUBMITTED',
        submissionMethod: 'PORTAL',
      }),
      'en',
      'user-1',
    );
  });

  it('still blocks submission when no saved or submitted channel exists', async () => {
    jest.spyOn(Appeal, 'findOne').mockResolvedValue(readinessReadyAppeal());
    jest.spyOn(Claim, 'findOne').mockResolvedValue({
      _id: 'claim-1',
      payerId: '60054',
      billingProviderId: 'provider-1',
      claimLines: [{ cptCode: 'D5110' }],
    } as any);
    jest.spyOn(Denial, 'findOne').mockResolvedValue({
      _id: 'denial-1',
      payerId: '60054',
      denialReason: 'Medical necessity',
    } as any);
    jest.spyOn(AppealPayerRule, 'findOne').mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    } as any);
    const changeStatusSpy = jest.spyOn(appealService, 'changeStatus').mockResolvedValue(readinessReadyAppeal({ appealStatus: 'SUBMITTED' }));

    await expect(appealService.submit('appeal-1', { reason: 'Submitted from UI work queue.' }, 'en', 'user-1'))
      .rejects.toThrow('SUBMISSION_CHANNEL_MISSING');

    expect(changeStatusSpy).not.toHaveBeenCalled();
  });

  it('uses the submission channel supplied by the final packet action during readiness validation', async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    } as any;
    const appeal = readinessReadyAppeal({
      appealStatus: 'PACKET_GENERATED',
      packetStatus: 'GENERATED',
      submissionMethod: undefined,
      submissionChannel: undefined,
      supportingDocumentsMetadata: [
        {
          documentId: 'doc-1',
          documentType: 'MEDICAL_RECORDS',
          fileName: 'medical-records.pdf',
          fileReference: '/api/v1/uploads/rcm/appeal-documents/medical-records.pdf',
          status: 'ACTIVE',
        },
        {
          documentId: 'doc-2',
          documentType: 'EOB_ERA_DOCUMENTS',
          fileName: 'era.pdf',
          fileReference: '/api/v1/uploads/rcm/appeal-documents/era.pdf',
          status: 'ACTIVE',
        },
      ],
      correspondenceHistory: [{ correspondenceType: 'PORTAL_UPLOAD', status: 'SENT' }],
      finalPacketVersion: 0,
      save: jest.fn().mockResolvedValue(undefined),
    });
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    jest.spyOn(Appeal, 'findOne').mockReturnValue(queryResolved(appeal) as any);
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved({
      _id: 'claim-1',
      payerId: '60054',
      billingProviderId: 'provider-1',
      claimLines: [{ cptCode: 'D5110' }],
    }) as any);
    jest.spyOn(Denial, 'findOne').mockReturnValue(queryResolved({
      _id: 'denial-1',
      payerId: '60054',
      denialReason: 'Medical necessity',
    }) as any);
    jest.spyOn(AppealPayerRule, 'findOne').mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    } as any);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined as any);

    const result = await appealService.generateFinalPacket('appeal-1', {
      reason: 'Final packet from UI.',
      submissionChannel: 'PORTAL',
    }, 'en', 'user-1');

    expect(result.submissionChannel).toBe('PORTAL');
    expect(result.readinessStatus).toBe('READY');
    expect(result.packetStatus).toBe('READY_FOR_SUBMISSION');
    expect(result.finalPacketFileReference).toContain('AppealPacket-final-v1.pdf');
  });
});
