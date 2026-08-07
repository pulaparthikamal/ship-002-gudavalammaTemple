import { PaymentPosting } from './payment-posting.model';
import { paymentPostingService } from './payment-posting.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';
import mongoose from 'mongoose';

describe('paymentPostingService append-only protections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks edits for ERA-created payment postings', async () => {
    jest.spyOn(PaymentPosting, 'findOne').mockResolvedValue({
      _id: 'posting-1',
      eraEobProcessingId: 'era-1',
      sourceType: '835_ERA',
      save: jest.fn(),
    } as any);

    await expect(
      paymentPostingService.update('posting-1', { postingStatus: 'POSTED' }, 'en', 'user-1'),
    ).rejects.toThrow('ERA-created payment postings are append-only');
  });

  it('blocks hard deletes for ERA-created payment postings', async () => {
    jest.spyOn(PaymentPosting, 'findOne').mockResolvedValue({
      _id: 'posting-1',
      eraEobProcessingId: 'era-1',
      sourceType: '835_ERA',
    } as any);
    jest.spyOn(PaymentPosting, 'findOneAndUpdate');

    await expect(
      paymentPostingService.softDelete('posting-1', 'en', 'user-1'),
    ).rejects.toThrow('ERA-created payment postings cannot be deleted');
    expect(PaymentPosting.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('allows controlled reversal with a required reason', async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    } as any;
    const posting = {
      _id: 'posting-1',
      claimId: 'claim-1',
      sourceType: '835_ERA',
      postingStatus: 'POSTED',
      postedAmount: 100,
      financialEventId: 'financial-event-1',
      save: jest.fn().mockResolvedValue(undefined),
    } as any;
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    jest.spyOn(PaymentPosting, 'findOne').mockReturnValue({
      session: jest.fn().mockResolvedValue(posting),
    } as any);
    jest.spyOn(financialEventService, 'findLatestForPaymentPosting').mockResolvedValue({
      _id: 'financial-event-1',
    } as any);
    jest.spyOn(financialEventService, 'record').mockResolvedValue({
      _id: 'financial-event-2',
      reversalOfId: 'financial-event-1',
      ledgerSequence: 2,
      financialBalanceSnapshot: { remainingBalance: 100 },
    } as any);
    jest.spyOn(claimClosureService, 'reopenForFinancialMutation').mockResolvedValue(false as any);
    jest.spyOn(claimClosureService, 'syncClaimClosureStatus').mockResolvedValue({} as any);

    const result = await paymentPostingService.reverse('posting-1', 'Duplicate ERA reversal', 'en', 'user-1');

    expect(result.postingStatus).toBe('REVERSED');
    expect(result.reversalReason).toBe('Duplicate ERA reversal');
    expect(financialEventService.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'PAYMENT_REVERSED',
      reversalOfId: 'financial-event-1',
    }));
    expect(claimClosureService.reopenForFinancialMutation).toHaveBeenCalledWith(
      'claim-1',
      expect.stringContaining('Payment posting posting-1 reversed'),
      'user-1',
      session,
    );
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1', session);
    expect(posting.save).toHaveBeenCalled();
  });
});
