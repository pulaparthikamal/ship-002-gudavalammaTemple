import { connectDB } from '../config/db.config';
import { Patient } from '../modules/rcm/patient/patient.model';
import { InsurancePolicy } from '../modules/rcm/insurance-policy/insurance-policy.model';
import { syncEntityDocuments } from '../modules/rcm/document/document-registry.service';
import { logger } from '../utils/logger.util';
import mongoose from 'mongoose';

function patientDocuments(patient: any) {
  return (patient.attachments ?? []).map((attachment: any) => ({
    ...attachment,
    sourceTag: 'source:patient-attachments',
  }));
}

function insurancePolicyDocuments(policy: any) {
  const card = policy.card ?? {};
  const cardAttachments: any[] = [
    card.frontImageUrl
      ? {
          sourceTag: 'source:insurance-card',
          documentType: 'Insurance Card',
          title: 'Insurance card front',
          fileUrl: card.frontImageUrl,
        }
      : null,
    card.backImageUrl
      ? {
          sourceTag: 'source:insurance-card',
          documentType: 'Insurance Card',
          title: 'Insurance card back',
          fileUrl: card.backImageUrl,
        }
      : null,
  ].filter(Boolean);

  const attachments = (policy.attachments ?? []).map((attachment: any) => ({
    ...attachment,
    sourceTag: 'source:insurance-documents',
  }));

  return [...cardAttachments, ...attachments];
}

async function run() {
  await connectDB();

  const patients = await Patient.find({ isDeleted: false }).select('_id attachments').lean();
  for (const patient of patients) {
    await syncEntityDocuments({
      entityType: 'patient',
      entityId: String(patient._id),
      patientId: String(patient._id),
      attachments: patientDocuments(patient),
      sourceTags: ['source:patient-attachments'],
    });
  }

  const policies = await InsurancePolicy.find({ isDeleted: false }).select('_id patientId card attachments').lean();
  for (const policy of policies) {
    await syncEntityDocuments({
      entityType: 'insurancePolicy',
      entityId: String(policy._id),
      patientId: String(policy.patientId),
      attachments: insurancePolicyDocuments(policy),
      sourceTags: ['source:insurance-card', 'source:insurance-documents'],
    });
  }

  logger.info(`Backfilled RCM documents from ${patients.length} patients and ${policies.length} insurance policies.`);
  await mongoose.connection.close();
}

run().catch(async (error) => {
  logger.error('RCM document backfill failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
