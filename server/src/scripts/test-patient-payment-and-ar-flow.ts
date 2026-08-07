import 'dotenv/config';
import mongoose from 'mongoose';
import { patientPaymentService } from '../modules/rcm/patient-payment/patient-payment.service';
import { arWorkItemService } from '../modules/rcm/ar-work-item/ar-work-item.service';
import { PatientBilling } from '../modules/rcm/patient-billing/patient-billing.model';
import { User } from '../modules/user/user.model';

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveActorUserId() {
  const configuredUserId = normalizeText(process.env.RCM_IMPORT_USER_ID);
  if (configuredUserId) {
    if (!mongoose.Types.ObjectId.isValid(configuredUserId)) {
      throw new Error('RCM_IMPORT_USER_ID must be a valid Mongo ObjectId.');
    }
    return configuredUserId;
  }

  const user = await User.findOne({
    active: true,
    isDeleted: false,
  }).sort({ updated: -1, created: -1 });

  if (!user) throw new Error('No active user found. Set RCM_IMPORT_USER_ID.');
  return String(user._id);
}

async function main() {
  const mongoUri = getMongoUri();
  if (!mongoUri) throw new Error('MONGO_URI or MONGODB_URI is required.');

  await mongoose.connect(mongoUri);
  const actorUserId = await resolveActorUserId();

  // Find a patient billing with balance > 0
  const billing = await PatientBilling.findOne({ isDeleted: false, currentBalance: { $gt: 0 } }).sort({ created: 1 });
  if (!billing) {
    console.log('No PatientBilling with currentBalance > 0 found.');
    await mongoose.disconnect();
    return;
  }

  console.log('Found PatientBilling:', String(billing._id));
  console.log('Original Balance:', billing.originalBalance, 'Current Balance:', billing.currentBalance);

  const paymentAmountEnv = Number(normalizeText(process.env.TEST_PAYMENT_AMOUNT)) || null;
  const paymentAmount = paymentAmountEnv ?? Math.max(1, Math.round((Number(billing.currentBalance) / 2) * 100) / 100);

  console.log('Applying payment amount:', paymentAmount);

  const payment = await patientPaymentService.create({
    patientBillingId: String(billing._id),
    amount: paymentAmount,
    paymentMethod: 'CARD',
  }, 'en', actorUserId);

  console.log('Payment created:', String(payment._id), 'appliedAmount:', payment.appliedAmount, 'overpaymentAmount:', payment.overpaymentAmount);

  const updatedBilling = await PatientBilling.findOne({ _id: billing._id });
  console.log('Updated Billing - Current Balance:', updatedBilling?.currentBalance, 'Status:', updatedBilling?.status);

  console.log('Generating operational AR work queue...');
  const result = await arWorkItemService.generateOperationalWorkQueue({}, 'en', actorUserId);
  console.log('AR Work Items createdOrUpdatedCount:', result.createdOrUpdatedCount);

  if (result.items && result.items.length) {
    console.log('AR Item IDs:');
    result.items.forEach((i: any) => console.log('-', String(i._id), i.category, i.reason));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exitCode = 1;
});
