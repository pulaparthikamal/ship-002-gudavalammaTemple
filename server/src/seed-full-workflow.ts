import mongoose from 'mongoose';
import { Appointment } from './modules/rcm/appointment/appointment.model';
import { Encounter } from './modules/rcm/encounter/encounter.model';
import { Charge } from './modules/rcm/charge/charge.model';
import { CodingReview } from './modules/rcm/coding-review/coding-review.model';
import { Claim } from './modules/rcm/claim/claim.model';
import { ClaimSubmission } from './modules/rcm/claim-submission/claim-submission.model';
import { Patient } from './modules/rcm/patient/patient.model';
import { Provider } from './modules/rcm/provider/provider.model';
import { Facility } from './modules/rcm/facility/facility.model';
import { Payer } from './modules/rcm/payer/payer.model';
import { ChargeMaster } from './modules/rcm/charge-master/charge-master.model';

async function seedFullWorkflow() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/db_sur2';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const patients = await Patient.find({ isDeleted: false });
    const providers = await Provider.find({ isDeleted: false });
    const facilities = await Facility.find({ isDeleted: false });
    const payers = await Payer.find({ isDeleted: false });
    const cmEntries = await ChargeMaster.find({ isDeleted: false }).limit(10);

    if (!patients.length || !providers.length || !facilities.length || !payers.length || !cmEntries.length) {
      console.log('Missing prerequisite data (patients, providers, facilities, payers, or chargemasters).');
      return;
    }

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      const provider = providers[i % providers.length];
      const facility = facilities[i % facilities.length];
      const payer = payers[i % payers.length];
      const cm = cmEntries[i % cmEntries.length];

      console.log(`Creating workflow for Patient: ${patient.firstName} ${patient.lastName}`);

      // 1. Appointment
      const appointment = await Appointment.create({
        patientId: patient._id,
        providerId: provider._id,
        facilityId: facility._id,
        appointmentDate: new Date(),
        appointmentTime: '10:00',
        appointmentType: 'New Patient',
        visitType: 'Office Visit',
        reason: cm.description || 'Follow up',
        appointmentStatus: 'Completed',
        checkInStatus: 'Checked Out',
      });

      // 2. Encounter
      const encounter = await Encounter.create({
        appointmentId: appointment._id,
        patientId: patient._id,
        providerId: provider._id,
        facilityId: facility._id,
        encounterDate: new Date(),
        visitStatus: 'Completed',
        chiefComplaint: cm.description,
        clinicalNotes: `Patient presented with ${cm.description}. Performed standard evaluation.`,
        procedureCodes: [cm.cptCode],
        procedureCodeUnits: new Map([[cm.cptCode!, 1]]),
        vitals: {
          temperature: 98.6,
          bloodPressure: '120/80',
          pulse: 72,
        },
      });

      // 3. Charge
      const charge = await Charge.create({
        encounterId: encounter._id,
        patientId: patient._id,
        providerId: provider._id,
        facilityId: facility._id,
        serviceDate: new Date(),
        chargeStatus: 'Approved',
        codingReviewStatus: 'Approved for Claim',
        totalChargeAmount: cm.defaultChargeAmount || 100,
        chargeLines: [
          {
            lineNumber: 1,
            cptCode: cm.cptCode,
            units: 1,
            chargeAmount: cm.defaultChargeAmount || 100,
            renderingProviderId: provider._id,
          },
        ],
      });

      // 4. Coding Review
      await CodingReview.create({
        chargeId: charge._id,
        encounterId: encounter._id,
        patientId: patient._id,
        scrubStatus: 'Passed',
        codingRiskLevel: 'Low',
        reviewedAt: new Date(),
        reviewedBy: 'System AI',
      });

      // 5. Claim
      const claim = await Claim.create({
        chargeId: charge._id,
        encounterId: encounter._id,
        patientId: patient._id,
        payerId: payer._id.toString(),
        renderingProviderId: provider._id,
        billingProviderId: provider._id,
        facilityId: facility._id,
        claimDate: new Date(),
        claimStatus: 'Submitted',
        totalChargeAmount: cm.defaultChargeAmount || 100,
        claimLines: [
          {
            lineNumber: 1,
            chargeLineId: (charge.chargeLines[0] as any)._id,
            cptCode: cm.cptCode,
            units: 1,
            chargeAmount: cm.defaultChargeAmount || 100,
            renderingProviderId: provider._id,
          },
        ],
      });

      // 6. Claim Submission
      await ClaimSubmission.create({
        claimId: claim._id,
        submissionMethod: 'Electronic',
        submissionDateTime: new Date(),
        transmissionStatus: 'Success',
        acknowledgementStatus: 'Accepted',
      });

      console.log(`Successfully completed workflow for ${patient.firstName}`);
    }

    console.log('Full workflow seeding completed!');
  } catch (error) {
    console.error('Error seeding full workflow:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seedFullWorkflow();
