import { auditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.model';
import { Appointment } from '../appointment/appointment.model';
import { Encounter } from '../encounter/encounter.model';
import { Charge } from '../charge/charge.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { Claim } from '../claim/claim.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { Payer } from '../payer/payer.model';
import { Facility } from '../facility/facility.model';

function mockFindChain(model: any, rows: any[]) {
  const chain: any = {
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return jest.spyOn(model, 'find').mockReturnValue(chain);
}

describe('auditLogService append-only and redaction controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks audit log updates permanently', async () => {
    await expect(auditLogService.update()).rejects.toMatchObject({
      statusCode: 405,
      message: expect.stringContaining('append-only'),
    });
  });

  it('blocks audit log deletes permanently', async () => {
    await expect(auditLogService.softDelete()).rejects.toMatchObject({
      statusCode: 405,
      message: expect.stringContaining('append-only'),
    });
  });

  it('blocks direct model updates and deletes through schema middleware', async () => {
    await expect(AuditLog.updateOne({ _id: 'audit-1' }, { action: 'MUTATED' })).rejects.toThrow('append-only');
    await expect(AuditLog.deleteOne({ _id: 'audit-1' })).rejects.toThrow('append-only');
    await expect(AuditLog.updateMany({}, { action: 'MUTATED' })).rejects.toThrow('append-only');
    await expect(AuditLog.deleteMany({})).rejects.toThrow('append-only');
  });

  it('redacts PHI and raw payload fields before persistence', () => {
    const safe = auditLogService.sanitizeForAudit({
      claimId: 'claim-1',
      raw835Payload: 'ISA*RAW',
      rawX12Payload: 'ISA*RAW',
      memberId: 'M123',
      subscriberNumber: 'SUB-1',
      apiKey: 'secret',
      token: 'token',
      patient: {
        firstName: 'Jane',
        lastName: 'Doe',
        dob: '1980-01-01',
        addressLine1: '123 Main',
        referenceId: 'patient-1',
      },
      nested: {
        amount: 10,
      },
    }) as any;

    expect(safe.claimId).toBe('claim-1');
    expect(safe.raw835Payload).toBe('[REDACTED]');
    expect(safe.rawX12Payload).toBe('[REDACTED]');
    expect(safe.memberId).toBe('[REDACTED]');
    expect(safe.subscriberNumber).toBe('[REDACTED]');
    expect(safe.apiKey).toBe('[REDACTED]');
    expect(safe.token).toBe('[REDACTED]');
    expect(safe.patient.firstName).toBe('[REDACTED]');
    expect(safe.patient.lastName).toBe('[REDACTED]');
    expect(safe.patient.dob).toBe('[REDACTED]');
    expect(safe.patient.addressLine1).toBe('[REDACTED]');
    expect(safe.patient.referenceId).toBe('patient-1');
    expect(safe.nested.amount).toBe(10);
  });

  it('creates a safe no-database audit event in isolated unit tests with missing optional context', async () => {
    const event = await auditLogService.record({
      entityType: 'claim',
      entityId: 'claim-1',
      action: 'CLAIM_CLOSED',
      appointmentId: 'appointment-1',
      newState: {
        rawX12Payload: 'ISA*RAW',
      },
    });

    expect(event.action).toBe('CLAIM_CLOSED');
    expect((event as any).severity).toBe('INFO');
    expect((event as any).category).toBe('CLOSURE');
    expect((event as any).visibility).toBe('COMPLIANCE_VISIBLE');
    expect((event as any).appointmentId).toBe('appointment-1');
    expect((event as any).newState.rawX12Payload).toBe('[REDACTED]');
  });

  it('hides technical debug audit events by default list criteria', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const findSpy = jest.spyOn(AuditLog, 'find').mockReturnValue({ sort } as any);
    jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(0 as any);

    await auditLogService.list({ appointmentId: 'appointment-1', severity: 'warning', category: 'queue' });

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      appointmentId: 'appointment-1',
      severity: 'WARNING',
      category: 'QUEUE',
      visibility: { $in: ['COMPLIANCE_VISIBLE', 'OPERATIONAL_VISIBLE'] },
      timestamp: expect.objectContaining({ $gte: expect.any(Date) }),
    }));
  });

  it('exports filtered audit logs as CSV with redacted filter metadata', async () => {
    const listSpy = jest.spyOn(auditLogService, 'list').mockResolvedValueOnce({
      data: [{
        timestamp: '2026-05-29T00:00:00.000Z',
        userId: 'user-1',
        userName: 'RCM Auditor',
        entityType: 'claim',
        entityId: 'claim-1',
        action: 'CLAIM_CLOSED',
        reason: 'Balanced',
        source: 'RCM',
        correlationId: 'corr-1',
        claimId: 'claim-1',
        patientId: 'patient-1',
        payerId: '60054',
        financialEventId: 'fe-1',
        appointmentId: 'appointment-1',
        severity: 'INFO',
        category: 'CLOSURE',
        visibility: 'COMPLIANCE_VISIBLE',
      }],
      pagination: {
        page: 1,
        limit: 1,
        totalCount: 1,
        totalPages: 1,
      },
    } as any);

    const exported = await auditLogService.export({
      claimId: 'claim-1',
      raw835Payload: 'ISA*RAW',
    });

    expect(exported.contentType).toBe('text/csv');
    expect(exported.fileName).toBe('rcm-audit-logs.csv');
    expect(exported.content).toContain('generatedAt,');
    expect(exported.content).toContain('"[REDACTED]"');
    expect(exported.content).not.toContain('ISA*RAW');
    expect(exported.content).toContain('CLAIM_CLOSED');
    expect(exported.content).toContain('appointmentId');
    expect(exported.content).toContain('COMPLIANCE_VISIBLE');
    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({
      claimId: 'claim-1',
      page: 1,
      limit: 5000,
    }));
  });

  it('returns a grouped claim lifecycle timeline from filtered audit events', async () => {
    jest.spyOn(auditLogService, 'list').mockResolvedValueOnce({
      data: [
        { entityType: 'claimSubmission', action: 'SUBMISSION_SENT', claimId: 'claim-1', correlationId: 'corr-1' },
        { entityType: 'eraEobProcessing', action: 'ERA_IMPORTED', claimId: 'claim-1', correlationId: 'corr-1' },
        { entityType: 'paymentPosting', action: 'PAYMENT_POSTED', claimId: 'claim-1', correlationId: 'corr-1' },
        { entityType: 'denial', action: 'DENIAL_CREATED_FROM_ERA', claimId: 'claim-1', correlationId: 'corr-1' },
        { entityType: 'appeal', action: 'APPEAL_OVERTURNED', claimId: 'claim-1', correlationId: 'corr-1' },
        { entityType: 'claim', action: 'CLAIM_CLOSED', claimId: 'claim-1', correlationId: 'corr-1' },
      ],
      pagination: { page: 1, limit: 5000, totalCount: 6, totalPages: 1 },
    } as any);

    const timeline = await auditLogService.getClaimTimeline('claim-1');

    expect(timeline.correlationIds).toEqual(['corr-1']);
    expect(timeline.groups.submission).toHaveLength(1);
    expect(timeline.groups.era).toHaveLength(1);
    expect(timeline.groups.payment).toHaveLength(1);
    expect(timeline.groups.denial).toHaveLength(1);
    expect(timeline.groups.appeal).toHaveLength(1);
    expect(timeline.groups.closure).toHaveLength(1);
    expect((timeline as any).sections.map((item: any) => item.section)).toEqual(expect.arrayContaining([
      'Submission / ACK',
      'ERA / Payment',
      'Denial / Appeal',
      'Closure',
    ]));
  });

  it('returns a grouped appointment lifecycle timeline from filtered audit events', async () => {
    jest.spyOn(auditLogService, 'list').mockResolvedValueOnce({
      data: [
        { entityType: 'appointment', action: 'APPOINTMENT_CREATED', appointmentId: 'appointment-1' },
        { entityType: 'encounter', action: 'ENCOUNTER_COMPLETED', appointmentId: 'appointment-1' },
        { entityType: 'charge', action: 'CHARGE_CREATED', appointmentId: 'appointment-1' },
        { entityType: 'claim', action: 'CLAIM_CREATED', appointmentId: 'appointment-1', claimId: 'claim-1', correlationId: 'corr-1' },
      ],
      pagination: { page: 1, limit: 5000, totalCount: 4, totalPages: 1 },
    } as any);

    const timeline = await auditLogService.getAppointmentTimeline('appointment-1');

    expect(timeline.claimIds).toEqual(['claim-1']);
    expect(timeline.correlationIds).toEqual(['corr-1']);
    expect(timeline.groups.appointment).toHaveLength(1);
    expect(timeline.groups.encounter).toHaveLength(1);
    expect(timeline.groups.charge).toHaveLength(1);
    expect(timeline.groups.claim).toHaveLength(1);
    expect((timeline as any).sections.map((item: any) => item.section)).toEqual(expect.arrayContaining([
      'Appointment',
      'Encounter',
      'Charge / Coding',
      'Claim',
    ]));
  });

  it('returns one appointment summary row with visible event and risk counts', async () => {
    const appointmentId = '64f000000000000000000001';
    const encounterId = '64f000000000000000000002';
    const chargeId = '64f000000000000000000003';
    const claimId = '64f000000000000000000004';
    const patientId = '64f000000000000000000005';
    const codingReviewId = '64f000000000000000000006';
    const eraId = '64f000000000000000000007';

    mockFindChain(Appointment, [{
      _id: appointmentId,
      patientId,
      appointmentDate: new Date('2026-05-29T10:00:00.000Z'),
      appointmentStatus: 'Completed',
      updated: new Date('2026-05-29T10:05:00.000Z'),
    }]);
    mockFindChain(Encounter, [{ _id: encounterId, appointmentId }]);
    mockFindChain(Charge, [{ _id: chargeId, encounterId, codingReviewStatus: 'Completed' }]);
    mockFindChain(CodingReview, [{
      _id: codingReviewId,
      chargeId,
      encounterId,
      patientId,
      scrubStatus: 'Passed',
      codingRiskLevel: 'Low',
      updated: new Date('2026-05-29T10:20:00.000Z'),
    }]);
    mockFindChain(Claim, [{
      _id: claimId,
      encounterId,
      chargeId,
      claimStatus: 'Submitted',
      submissionStatus: 'Acknowledged',
      paymentStatus: 'DENIED',
      closureStatus: 'OPEN',
    }]);
    mockFindChain(EraEobProcessing, [{ _id: eraId, matchedClaims: [{ claimId }] }]);
    const auditFind = mockFindChain(AuditLog, [
      {
        _id: 'audit-1',
        appointmentId,
        claimId,
        action: 'DENIAL_CREATED',
        severity: 'WARNING',
        timestamp: new Date('2026-05-29T11:00:00.000Z'),
      },
      {
        _id: 'audit-era-1',
        entityType: 'eraEobProcessing',
        entityId: eraId,
        action: 'ERA_IMPORTED',
        severity: 'INFO',
        timestamp: new Date('2026-05-29T10:55:00.000Z'),
      },
    ]);

    const result = await auditLogService.getAppointmentSummaries({ page: 1, limit: 25 });

    expect(auditFind).toHaveBeenCalledWith(expect.objectContaining({
      visibility: { $in: ['COMPLIANCE_VISIBLE', 'OPERATIONAL_VISIBLE'] },
    }));
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      appointmentId,
      patientReference: patientId,
      encounterId,
      chargeId,
      claimId,
      currentStage: 'Payment',
      lastAuditAction: 'DENIAL_CREATED',
      eventCount: 8,
      openRiskCount: 1,
      status: 'Needs Review',
      severity: 'WARNING',
    });
  });

  it('returns one claim summary row with payer, facility, and last audit action', async () => {
    const claimId = '64f000000000000000000014';
    const patientId = '64f000000000000000000015';
    const facilityId = '64f000000000000000000016';

    mockFindChain(Claim, [{
      _id: claimId,
      patientId,
      payerId: '60054',
      facilityId,
      claimStatus: 'Submitted',
      submissionStatus: 'Acknowledged',
      paymentStatus: 'PAID',
      closureStatus: 'READY_TO_CLOSE',
      updated: new Date('2026-05-29T12:00:00.000Z'),
    }]);
    mockFindChain(Payer, [{ payerId: '60054', payerName: 'Aetna Insurance Company' }]);
    mockFindChain(Facility, [{ _id: facilityId, facilityName: 'Main Clinic' }]);
    mockFindChain(AuditLog, [{
      _id: 'audit-claim-1',
      claimId,
      action: 'PAYMENT_POSTED',
      severity: 'INFO',
      timestamp: new Date('2026-05-29T12:30:00.000Z'),
    }]);

    const result = await auditLogService.getClaimSummaries({ payerId: '60054' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      claimId,
      patientReference: patientId,
      payerName: 'Aetna Insurance Company',
      facilityName: 'Main Clinic',
      claimStatus: 'Submitted',
      submissionStatus: 'Acknowledged',
      paymentStatus: 'PAID',
      closureStatus: 'READY_TO_CLOSE',
      lastAuditAction: 'PAYMENT_POSTED',
      eventCount: 1,
      openRiskCount: 0,
      status: 'READY_TO_CLOSE',
      severity: 'INFO',
    });
  });
});
