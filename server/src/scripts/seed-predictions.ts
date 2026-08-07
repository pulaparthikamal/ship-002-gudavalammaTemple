import mongoose from 'mongoose';
import { PaymentPosting } from '../modules/rcm/payment-posting/payment-posting.model';
import { Claim } from '../modules/rcm/claim/claim.model';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp_sur_1';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const payerId = 'PAYERID001';
  const codes = [
    { code: 'D1001', allowed: 85, paid: 68 },
    { code: 'D3330', allowed: 450, paid: 360 },
    { code: '99213', allowed: 120, paid: 96 },
    { code: '99214', allowed: 180, paid: 144 },
  ];

  // We need at least one claim to reference
  let claim = await Claim.findOne({ payerId });
  if (!claim) {
    console.log('No claim found for payer PAYERID001, creating a dummy one');
    claim = await Claim.create({
      claimId: new mongoose.Types.ObjectId(),
      payerId,
      claimDate: new Date(),
      totalChargeAmount: 1000,
      claimStatus: 'Submitted',
      claimLines: codes.map((c, i) => ({
        lineNumber: i + 1,
        cptCode: c.code,
        units: 1,
        chargeAmount: c.allowed * 1.5,
        chargeLineId: new mongoose.Types.ObjectId()
      })),
      active: true,
      isDeleted: false
    });
  }

  console.log('Using Claim ID:', claim._id);

  const postings = [];

  for (const item of codes) {
    console.log(`Seeding 25 records for code ${item.code}...`);
    for (let i = 0; i < 25; i++) {
      // Variance for realism
      const variance = (Math.random() * 0.1) - 0.05; // +/- 5%
      const allowed = item.allowed * (1 + variance);
      const paid = item.paid * (1 + variance);

      postings.push({
        paymentPostingId: new mongoose.Types.ObjectId(),
        claimId: claim._id,
        payerId,
        checkNumber: `CHK-${Math.floor(Math.random() * 1000000)}`,
        checkDate: new Date(),
        totalPaidAmount: paid,
        paymentLines: [
          {
            claimLineId: claim.claimLines.find(l => l.cptCode === item.code)?.chargeLineId || new mongoose.Types.ObjectId(),
            allowedAmount: allowed,
            paidAmount: paid,
            patientRespAmount: allowed - paid,
            deniedAmount: 0,
            adjustmentAmount: (item.allowed * 1.5) - allowed,
          }
        ],
        active: true,
        isDeleted: false,
        created: new Date(),
        updated: new Date()
      });
    }
  }

  await PaymentPosting.insertMany(postings);
  console.log(`Successfully seeded ${postings.length} payment posting records.`);

  await mongoose.disconnect();
}

seed().catch(console.error);

