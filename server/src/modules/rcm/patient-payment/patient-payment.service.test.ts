import { patientPaymentService } from './patient-payment.service';
import { PatientPayment } from './patient-payment.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Refund } from '../refund/refund.model';
import { collectionService } from '../collection/collection.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';

jest.mock('../../../utils/mongoose-transaction.util', () => ({
  withMongoTransaction: jest.fn(async (operation: any) => operation({ id: 'session' })),
}));

jest.mock('../collection/collection.service', () => ({
  collectionService: {
    ensureFromPatientBilling: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../financial-event/financial-event.service', () => ({
  financialEventService: {
    record: jest.fn().mockResolvedValue({ _id: 'financial-event-1', ledgerSequence: 1 }),
  },
}));

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
    reopenForFinancialMutation: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

function queryResolved(value: any) {
  return {
    session: jest.fn().mockResolvedValue(value),
  };
}

describe('patientPaymentService.create', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(PatientPayment, 'findOne').mockReturnValue(queryResolved(null) as any);
  });

  it('creates a patient payment and partially reduces the linked billing balance', async () => {
    const billing: any = {
      _id: 'billing-1',
      patientId: 'patient-1',
      claimId: 'claim-1',
      originalBalance: 100,
      currentBalance: 100,
      amountDue: 100,
      patientBalance: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const payment = {
      _id: 'payment-1',
      patientBillingId: billing._id,
      patientId: billing.patientId,
      claimId: billing.claimId,
      amount: 40,
      appliedAmount: 40,
      overpaymentAmount: 0,
      paymentStatus: 'POSTED',
    };

    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);
    jest.spyOn(PatientPayment, 'create').mockResolvedValue([payment] as any);
    jest.spyOn(PatientPayment, 'find').mockReturnValue(queryResolved([payment]) as any);
    jest.spyOn(Refund, 'findOneAndUpdate').mockResolvedValue(null as any);

    const result = await patientPaymentService.create({
      patientBillingId: billing._id,
      amount: 40,
      paymentMethod: 'CARD',
      idempotencyKey: 'payment-test-1',
    }, 'en', 'user-1');

    expect(result).toBe(payment);
    expect(PatientPayment.create).toHaveBeenCalledWith([
      expect.objectContaining({
        patientBillingId: billing._id,
        patientId: billing.patientId,
        claimId: billing.claimId,
        amount: 40,
        appliedAmount: 40,
        overpaymentAmount: 0,
        paymentStatus: 'POSTED',
      }),
    ], { session: { id: 'session' } });
    expect(billing.patientPayments).toBe(40);
    expect(billing.amountPaid).toBe(40);
    expect(billing.currentBalance).toBe(60);
    expect(billing.amountDue).toBe(60);
    expect(billing.status).toBe('PARTIALLY_PAID');
    expect(billing.statementStatus).toBe('PARTIALLY_PAID');
    expect(billing.save).toHaveBeenCalledWith({ session: { id: 'session' } });
    expect(Refund.findOneAndUpdate).not.toHaveBeenCalled();
    expect(collectionService.ensureFromPatientBilling).toHaveBeenCalledWith(billing, {}, 'en', 'user-1', { session: { id: 'session' } });
    expect(financialEventService.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'PATIENT_PAYMENT_POSTED',
      claimId: 'claim-1',
      patientBillingId: 'billing-1',
    }));
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1', { id: 'session' });
  });

  it('marks billing paid when applied payments cover the balance', async () => {
    const billing: any = {
      _id: 'billing-2',
      patientId: 'patient-2',
      claimId: 'claim-2',
      originalBalance: 100,
      currentBalance: 60,
      amountDue: 60,
      patientBalance: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const existingPayment = {
      _id: 'payment-existing',
      patientBillingId: billing._id,
      appliedAmount: 40,
      overpaymentAmount: 0,
      paymentStatus: 'POSTED',
      active: true,
    };
    const payment = {
      _id: 'payment-2',
      patientBillingId: billing._id,
      patientId: billing.patientId,
      claimId: billing.claimId,
      amount: 60,
      appliedAmount: 60,
      overpaymentAmount: 0,
      paymentStatus: 'POSTED',
    };

    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);
    jest.spyOn(PatientPayment, 'create').mockResolvedValue([payment] as any);
    jest.spyOn(PatientPayment, 'find').mockReturnValue(queryResolved([existingPayment, payment]) as any);
    jest.spyOn(Refund, 'findOneAndUpdate').mockResolvedValue(null as any);

    await patientPaymentService.create({
      patientBillingId: billing._id,
      amount: 60,
      paymentMethod: 'ACH',
      idempotencyKey: 'payment-test-2',
    }, 'en', 'user-1');

    expect(billing.patientPayments).toBe(100);
    expect(billing.amountPaid).toBe(100);
    expect(billing.currentBalance).toBe(0);
    expect(billing.amountDue).toBe(0);
    expect(billing.status).toBe('PAID');
    expect(billing.statementStatus).toBe('PAID');
    expect(billing.refundFlag).toBe(false);
    expect(billing.refundAmount).toBe(0);
    expect(collectionService.ensureFromPatientBilling).not.toHaveBeenCalled();
  });

  it('creates a refund candidate when patient payment exceeds the current billing balance', async () => {
    const billing: any = {
      _id: 'billing-3',
      patientId: 'patient-3',
      claimId: 'claim-3',
      originalBalance: 100,
      currentBalance: 25,
      amountDue: 25,
      patientBalance: 100,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const existingPayment = {
      _id: 'payment-existing',
      patientBillingId: billing._id,
      appliedAmount: 75,
      overpaymentAmount: 0,
      paymentStatus: 'POSTED',
      active: true,
    };
    const payment = {
      _id: 'payment-3',
      patientBillingId: billing._id,
      patientId: billing.patientId,
      claimId: billing.claimId,
      amount: 40,
      appliedAmount: 25,
      overpaymentAmount: 15,
      paymentMethod: 'CARD',
      paymentStatus: 'POSTED',
    };

    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);
    jest.spyOn(PatientPayment, 'create').mockResolvedValue([payment] as any);
    jest.spyOn(PatientPayment, 'find').mockReturnValue(queryResolved([existingPayment, payment]) as any);
    jest.spyOn(Refund, 'findOneAndUpdate').mockResolvedValue({ _id: 'refund-1' } as any);

    await patientPaymentService.create({
      patientBillingId: billing._id,
      amount: 40,
      paymentMethod: 'CARD',
      idempotencyKey: 'payment-test-3',
    }, 'en', 'user-1');

    expect(PatientPayment.create).toHaveBeenCalledWith([
      expect.objectContaining({
        amount: 40,
        appliedAmount: 25,
        overpaymentAmount: 15,
      }),
    ], { session: { id: 'session' } });
    expect(billing.currentBalance).toBe(0);
    expect(billing.amountDue).toBe(0);
    expect(billing.status).toBe('PAID');
    expect(billing.refundFlag).toBe(true);
    expect(billing.refundAmount).toBe(15);
    expect(billing.creditBalanceAmount).toBe(15);
    expect(Refund.findOneAndUpdate).toHaveBeenCalledWith(
      { patientPaymentId: payment._id, isDeleted: false },
      expect.objectContaining({
        $set: expect.objectContaining({
          patientBillingId: billing._id,
          patientPaymentId: payment._id,
          refundType: 'PATIENT_OVERPAYMENT',
          refundAmount: 15,
          balanceImpactAmount: 0,
          refundStatus: 'PENDING_REVIEW',
        }),
      }),
      { upsert: true, new: true, session: { id: 'session' } }
    );
    expect(collectionService.ensureFromPatientBilling).not.toHaveBeenCalled();
  });

  it('keeps an unpaid overdue balance open and asks collections to evaluate it', async () => {
    const billing: any = {
      _id: 'billing-4',
      patientId: 'patient-4',
      claimId: 'claim-4',
      originalBalance: 100,
      currentBalance: 100,
      amountDue: 100,
      patientBalance: 100,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const payment = {
      _id: 'payment-4',
      patientBillingId: billing._id,
      patientId: billing.patientId,
      claimId: billing.claimId,
      amount: 30,
      appliedAmount: 30,
      overpaymentAmount: 0,
      paymentStatus: 'POSTED',
    };

    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);
    jest.spyOn(PatientPayment, 'create').mockResolvedValue([payment] as any);
    jest.spyOn(PatientPayment, 'find').mockReturnValue(queryResolved([payment]) as any);
    jest.spyOn(Refund, 'findOneAndUpdate').mockResolvedValue(null as any);

    await patientPaymentService.create({
      patientBillingId: billing._id,
      amount: 30,
      paymentMethod: 'CHECK',
      idempotencyKey: 'payment-test-4',
    }, 'en', 'user-1');

    expect(billing.currentBalance).toBe(70);
    expect(billing.amountDue).toBe(70);
    expect(billing.status).toBe('OVERDUE');
    expect(billing.statementStatus).toBe('OVERDUE');
    expect(collectionService.ensureFromPatientBilling).toHaveBeenCalledWith(billing, {}, 'en', 'user-1', { session: { id: 'session' } });
  });

  it('returns an existing payment for duplicate idempotency and does not create another refund candidate', async () => {
    const duplicatePayment = {
      _id: 'payment-existing-duplicate',
      patientBillingId: 'billing-duplicate',
      amount: 25,
      paymentStatus: 'POSTED',
      idempotencyKey: 'payment-duplicate',
    };
    (PatientPayment.findOne as jest.Mock).mockReturnValue(queryResolved(duplicatePayment) as any);
    jest.spyOn(PatientPayment, 'create').mockResolvedValue([] as any);
    jest.spyOn(Refund, 'findOneAndUpdate').mockResolvedValue(null as any);

    const result = await patientPaymentService.create({
      patientBillingId: 'billing-duplicate',
      amount: 25,
      idempotencyKey: 'payment-duplicate',
    }, 'en', 'user-1');

    expect(result).toBe(duplicatePayment);
    expect(PatientPayment.create).not.toHaveBeenCalled();
    expect(Refund.findOneAndUpdate).not.toHaveBeenCalled();
    expect(financialEventService.record).not.toHaveBeenCalled();
  });
});
