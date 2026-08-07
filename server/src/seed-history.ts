import mongoose from 'mongoose';
import { ChargeMaster } from './modules/rcm/charge-master/charge-master.model';
import { Claim } from './modules/rcm/claim/claim.model';
import { PaymentPosting } from './modules/rcm/payment-posting/payment-posting.model';
import { Payer } from './modules/rcm/payer/payer.model';
import { Patient } from './modules/rcm/patient/patient.model';

async function seedHistory() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/db_sur2';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const payers = await Payer.find({ isDeleted: false });
    if (payers.length === 0) {
      console.log('No payers found. Please seed payers first.');
      return;
    }

    const patients = await Patient.find({ isDeleted: false });
    if (patients.length === 0) {
      console.log('No patients found. Please seed patients first.');
      return;
    }

    const cmEntries = await ChargeMaster.find({ isDeleted: false }).limit(5);
    if (cmEntries.length === 0) {
      console.log('No ChargeMaster entries found. Please seed ChargeMaster first.');
      return;
    }

    for (const cm of cmEntries) {
      for (const payer of payers) {
        console.log(`Seeding history for CPT ${cm.cptCode} and Payer ${payer.payerName}`);

        // Create 3 historical claims per code/payer
        for (let i = 0; i < 3; i++) {
          const claim = await Claim.create({
            patientId: patients[0]._id,
            payerId: payer._id.toString(),
            claimStatus: 'Submitted',
            totalChargeAmount: cm.defaultChargeAmount || 100,
            claimLines: [
              {
                lineNumber: 1,
                cptCode: cm.cptCode,
                chargeAmount: cm.defaultChargeAmount || 100,
                units: 1,
              },
            ],
          });

          // Create payment posting
          const allowed = (cm.defaultAllowedAmount || (cm.defaultChargeAmount || 100) * 0.8);
          const paid = allowed * 0.9;
          const patientResp = allowed - paid;

          await PaymentPosting.create({
            claimId: claim._id,
            payerId: payer._id.toString(),
            paymentDate: new Date(),
            postingStatus: 'Posted',
            paymentLines: [
              {
                paidAmount: paid,
                allowedAmount: allowed,
                patientRespAmount: patientResp,
                deniedAmount: 0,
              },
            ],
          });
        }
      }
    }

    console.log('Seeding historical data completed!');
  } catch (error) {
    console.error('Error seeding history:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seedHistory();
