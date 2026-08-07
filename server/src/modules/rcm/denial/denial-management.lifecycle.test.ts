import { appealService } from '../appeal/appeal.service';
import { denialService } from './denial.service';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { paymentPostingService } from '../payment-posting/payment-posting.service';
import { patientBillingService } from '../patient-billing/patient-billing.service';
import { patientPaymentService } from '../patient-payment/patient-payment.service';
import { refundService } from '../refund/refund.service';
import { collectionService } from '../collection/collection.service';
import { correctedClaimService } from '../corrected-claim/corrected-claim.service';
import { patientBillingController } from '../patient-billing/patient-billing.controller';
import { assertDenialTransition, normalizeDenialStatus } from './denial-workflow.service';

describe('denial management controlled lifecycle protections', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('blocks denial deletion in production', async () => {
    process.env.NODE_ENV = 'production';

    await expect(denialService.softDelete('denial-1', 'en', 'user-1'))
      .rejects
      .toThrow('Denial records are append-only in production');
  });

  it('blocks appeal deletion in production', async () => {
    process.env.NODE_ENV = 'production';

    await expect(appealService.softDelete('appeal-1', 'en', 'user-1'))
      .rejects
      .toThrow('Appeal records are append-only in production');
  });

  it('keeps ERA-created payment postings immutable after denial resolution workflow', async () => {
    jest.spyOn(PaymentPosting, 'findOne').mockResolvedValue({
      _id: 'posting-1',
      eraEobProcessingId: 'era-1',
      sourceType: '835_ERA',
    } as any);

    await expect(
      paymentPostingService.update('posting-1', { postedAmount: 0 }, 'en', 'user-1'),
    ).rejects.toThrow('ERA-created payment postings are append-only');
  });

  it('blocks unsafe generic financial/workflow updates in production', async () => {
    process.env.NODE_ENV = 'production';

    await expect(patientBillingService.update('billing-1', { status: 'PAID' }, 'en', 'user-1'))
      .rejects.toThrow('Patient billing records are append-only in production');
    await expect(patientPaymentService.update('payment-1', { amount: 0 }, 'en', 'user-1'))
      .rejects.toThrow('Patient payment records are append-only in production');
    await expect(refundService.update('refund-1', { refundAmount: 0 }, 'en', 'user-1'))
      .rejects.toThrow('Refund records are append-only in production');
    await expect(collectionService.update('collection-1', { status: 'CLOSED' }, 'en', 'user-1'))
      .rejects.toThrow('Collection records are append-only in production');
    await expect(correctedClaimService.update('corrected-1', { correctedClaimStatus: 'CLOSED' }, 'en', 'user-1'))
      .rejects.toThrow('Corrected claim records are append-only in production');
    await expect(denialService.update('denial-1', { denialStatus: 'RESOLVED' }, 'en', 'user-1'))
      .rejects.toThrow('Denial records are append-only in production');
    await expect(appealService.update('appeal-1', { appealStatus: 'CLOSED' }, 'en', 'user-1'))
      .rejects.toThrow('Appeal records are append-only in production');
  });

  it('blocks unsafe bulk route handlers in production', async () => {
    process.env.NODE_ENV = 'production';
    const req = { body: { ids: ['billing-1'] }, locale: 'en', user: { _id: 'user-1' } } as any;
    const res = { json: jest.fn() } as any;

    await expect(patientBillingController.bulkDelete(req, res))
      .rejects.toThrow('Patient billing records are append-only in production');
  });

  it('enforces strict denial lifecycle transitions', () => {
    expect(assertDenialTransition('OPEN', 'APPEAL_READY')).toEqual({ from: 'OPEN', to: 'APPEAL_READY' });
    expect(assertDenialTransition('APPEAL_READY', 'APPEALED')).toEqual({ from: 'APPEAL_READY', to: 'APPEALED' });
    expect(assertDenialTransition('APPEALED', 'PAYER_REVIEW')).toEqual({ from: 'APPEALED', to: 'PAYER_REVIEW' });
    expect(assertDenialTransition('PAYER_REVIEW', 'OVERTURNED')).toEqual({ from: 'PAYER_REVIEW', to: 'OVERTURNED' });
    expect(assertDenialTransition('OVERTURNED', 'RESOLVED')).toEqual({ from: 'OVERTURNED', to: 'RESOLVED' });
    expect(() => assertDenialTransition('OPEN', 'CLOSED')).toThrow('Invalid denial transition from OPEN to CLOSED');
    expect(() => assertDenialTransition('APPEAL_READY', 'OVERTURNED')).toThrow('Invalid denial transition from APPEAL_READY to OVERTURNED');
  });

  it('normalizes legacy denial statuses into the enterprise lifecycle', () => {
    expect(normalizeDenialStatus('AWAITING_PAYER_RESPONSE')).toBe('PAYER_REVIEW');
    expect(normalizeDenialStatus('CORRECTED_CLAIM_SUBMITTED')).toBe('CORRECTED_CLAIM_PENDING');
  });
});
