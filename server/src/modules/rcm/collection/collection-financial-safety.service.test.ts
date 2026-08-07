import { collectionService } from './collection.service';
import { Collection } from './collection.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';

jest.mock('../../../utils/mongoose-transaction.util', () => ({
  withMongoTransaction: (operation: (session?: unknown) => Promise<unknown>) => operation(undefined),
}));
jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));
jest.mock('../financial-event/financial-event.service', () => ({
  financialEventService: { record: jest.fn().mockResolvedValue({ _id: 'event-1' }) },
}));
jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
    reopenForFinancialMutation: jest.fn().mockResolvedValue(false),
  },
}));

function queryResolved(value: any) {
  return { session: jest.fn().mockResolvedValue(value) };
}

describe('collection financial controls', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('blocks off-ledger collection settlement', async () => {
    const collection: any = { _id: 'collection-1', claimId: 'claim-1' };
    jest.spyOn(Collection, 'findOne').mockReturnValue(queryResolved(collection) as any);

    await expect(collectionService.applyAction(
      'collection-1',
      'SETTLED',
      { settlementAmount: 20, reason: 'Patient settled.' },
      'en',
      'user-1'
    )).rejects.toThrow('Record a patient payment instead');
    expect(financialEventService.record).not.toHaveBeenCalled();
  });

  it('records a collection write-off through the financial ledger and resynchronizes closure', async () => {
    const collection: any = {
      _id: 'collection-2',
      claimId: 'claim-2',
      patientBillingId: 'billing-2',
      currentBalance: 50,
      balanceAmount: 50,
      actionAudit: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const billing: any = {
      _id: 'billing-2',
      currentBalance: 50,
      amountDue: 50,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Collection, 'findOne').mockReturnValue(queryResolved(collection) as any);
    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);
    jest.spyOn(Adjustment, 'create').mockResolvedValue([{ _id: 'adjustment-writeoff' }] as any);

    const result = await collectionService.applyAction(
      'collection-2',
      'WRITE_OFF',
      { writeOffAmount: 50, reason: 'Approved uncollectible balance.' },
      'en',
      'user-1'
    );

    expect(result.status).toBe('WRITTEN_OFF');
    expect(claimClosureService.reopenForFinancialMutation).toHaveBeenCalled();
    expect(financialEventService.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'COLLECTION_WRITE_OFF',
      amount: 50,
      claimId: 'claim-2',
      adjustmentId: 'adjustment-writeoff',
    }));
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-2', 'user-1', undefined);
  });

  it('logs collection contact without requiring a financial mutation', async () => {
    const collection: any = {
      _id: 'collection-3',
      claimId: 'claim-3',
      patientBillingId: 'billing-3',
      contactAttempts: 0,
      actionAudit: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const billing: any = {
      _id: 'billing-3',
      currentBalance: 65,
      amountDue: 65,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Collection, 'findOne').mockReturnValue(queryResolved(collection) as any);
    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);

    const result = await collectionService.applyAction(
      'collection-3',
      'LOG_CONTACT',
      { notes: 'Contact attempt logged from collections queue.' },
      'en',
      'user-1'
    );

    expect(result.status).toBe('CONTACTED');
    expect(result.contactAttempts).toBe(1);
    expect(result.actionAudit).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'LOG_CONTACT' }),
    ]));
    expect(financialEventService.record).not.toHaveBeenCalled();
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-3', 'user-1', undefined);
  });
});
