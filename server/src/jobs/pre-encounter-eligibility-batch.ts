import mongoose from 'mongoose';
import { connectDB } from '../config/db.config';
import { Appointment } from '../modules/rcm/appointment/appointment.model';
import { InsurancePolicy } from '../modules/rcm/insurance-policy/insurance-policy.model';
import { Payer } from '../modules/rcm/payer/payer.model';
import { eligibilityVerificationService } from '../modules/rcm/eligibility-verification/eligibility-verification.service';
import { logger } from '../utils/logger.util';

const SYSTEM_USER = {
  _id: new mongoose.Types.ObjectId().toString(),
  firstName: 'System',
  lastName: 'Batch',
  email: 'system@batch.local'
};

async function runBatch() {
  try {
    await connectDB();
    logger.info('Starting Pre-Encounter Eligibility Batch Job...');

    const now = new Date();
    const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);   // 48 hours from now

    const appointments = await Appointment.find({
      appointmentStatus: 'Scheduled',
      appointmentDate: {
        $gte: windowStart,
        $lte: windowEnd
      },
      isDeleted: false,
      active: true
    });

    logger.info(`Found ${appointments.length} scheduled appointments within the 24-48h window.`);

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const appt of appointments) {
      try {
        const activePolicy = await InsurancePolicy.findOne({
          patientId: appt.patientId,
          active: true,
          isDeleted: false
        }).sort({ coveragePriority: 1 });

        if (!activePolicy) {
          skippedCount++;
          continue;
        }

        const payer = await Payer.findOne({ _id: activePolicy.payerId, isDeleted: false });
        
        if (!payer || !payer.eligibilityApiSupported) {
          skippedCount++;
          continue;
        }

        await eligibilityVerificationService.runRealtimeVerification(
          {
            appointmentId: String(appt._id),
            insuranceId: String(activePolicy._id),
            serviceTypeCode: '30'
          },
          'en',
          SYSTEM_USER
        );

        successCount++;
        logger.info(`Successfully verified eligibility for appointment ${appt._id}`);
      } catch (err) {
        failureCount++;
        logger.error(`Failed to verify eligibility for appointment ${appt._id}:`, err);
      }
    }

    logger.info(`Batch complete. Success: ${successCount}, Failed: ${failureCount}, Skipped: ${skippedCount}`);
    
  } catch (error) {
    logger.error('Failed to run batch job:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runBatch();
