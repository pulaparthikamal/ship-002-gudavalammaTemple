import { patientBillingService } from './patient-billing.service';
import { PatientBilling } from './patient-billing.model';
import { collectionService } from '../collection/collection.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';

jest.mock('../collection/collection.service', () => ({
  collectionService: {
    ensureFromPatientBilling: jest.fn().mockResolvedValue({ _id: 'collection-1' }),
  },
}));

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

describe('patientBillingService.applyAction', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('sends an open patient statement through a controlled action', async () => {
    const billing: any = {
      _id: 'billing-1',
      claimId: 'claim-1',
      currentBalance: 45,
      status: 'READY_TO_SEND',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(PatientBilling, 'findOne').mockResolvedValue(billing);

    const result = await patientBillingService.applyAction('billing-1', 'SEND_STATEMENT', {}, 'en', 'user-1');

    expect(result.status).toBe('SENT');
    expect(result.statementStatus).toBe('SENT');
    expect(result.lastStatementSent).toBeInstanceOf(Date);
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1');
    expect(publishRcmRealtimeEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'PATIENT_BILLING_STATUS_CHANGED',
      entityType: 'patientBilling',
      status: 'SENT',
    }));
  });

  it('refers an open patient balance into collections and creates its collections record', async () => {
    const billing: any = {
      _id: 'billing-2',
      claimId: 'claim-2',
      currentBalance: 100,
      status: 'SENT',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(PatientBilling, 'findOne').mockResolvedValue(billing);

    await patientBillingService.applyAction(
      'billing-2',
      'MARK_COLLECTIONS_READY',
      { reason: 'Balance remains unpaid after patient contact.' },
      'en',
      'user-1',
    );

    expect(billing.status).toBe('COLLECTIONS_READY');
    expect(billing.collectionsFlag).toBe(true);
    expect(collectionService.ensureFromPatientBilling).toHaveBeenCalledWith(billing, {}, 'en', 'user-1');
  });

  it('requires a reason before referring a patient balance into collections', async () => {
    const billing: any = {
      _id: 'billing-3',
      currentBalance: 75,
      status: 'SENT',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(PatientBilling, 'findOne').mockResolvedValue(billing);

    await expect(
      patientBillingService.applyAction('billing-3', 'MARK_COLLECTIONS_READY', {}, 'en', 'user-1'),
    ).rejects.toThrow('Collections referral reason is required.');
    expect(collectionService.ensureFromPatientBilling).not.toHaveBeenCalled();
  });
});
