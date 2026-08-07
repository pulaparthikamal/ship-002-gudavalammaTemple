import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { User } from '../modules/user/user.model';
import { eraEobProcessingService } from '../modules/rcm/era-eob-processing/era-eob-processing.service';

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalNumber(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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

  if (!user) {
    throw new Error('No active user was found. Set RCM_IMPORT_USER_ID to a valid user ObjectId for audit attribution.');
  }

  return String(user._id);
}

async function main() {
  const mongoUri = getMongoUri();
  const eraFile = normalizeText(process.env.ERA_835_FILE);

  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required to import an ERA 835 file.');
  }

  if (!eraFile) {
    throw new Error('ERA_835_FILE is required and must point to an 835 file.');
  }

  const absoluteEraFile = path.resolve(process.cwd(), eraFile);
  if (!fs.existsSync(absoluteEraFile)) {
    throw new Error(`ERA_835_FILE does not exist: ${absoluteEraFile}`);
  }

  const raw835Text = fs.readFileSync(absoluteEraFile, 'utf8');
  if (!raw835Text.trim()) {
    throw new Error(`ERA_835_FILE is empty: ${absoluteEraFile}`);
  }

  await mongoose.connect(mongoUri);
  const actorUserId = await resolveActorUserId();
  const result = await eraEobProcessingService.import835({
    raw835Text,
    payerId: normalizeText(process.env.ERA_PAYER_ID),
    payerName: normalizeText(process.env.ERA_PAYER_NAME),
    eraFileReference: path.basename(absoluteEraFile),
    depositId: normalizeText(process.env.ERA_DEPOSIT_ID),
    depositAmount: optionalNumber(process.env.ERA_DEPOSIT_AMOUNT),
    sourceType: normalizeText(process.env.ERA_SOURCE_TYPE) || 'MANUAL_IMPORT',
    fileMetadata: {
      fileName: path.basename(absoluteEraFile),
      sourcePath: absoluteEraFile,
      importedByScript: 'import-era-835-file',
    },
  }, 'en', actorUserId);

  console.log(JSON.stringify({
    imported: true,
    duplicate: Boolean((result as any).duplicate),
    eraEobProcessing: {
      id: String(result.eraEobProcessing._id),
      reconciliationStatus: result.eraEobProcessing.reconciliationStatus,
      importStatus: result.eraEobProcessing.importStatus,
      parsedStatus: result.eraEobProcessing.parsedStatus,
      totalPaymentAmount: result.eraEobProcessing.totalPaymentAmount,
      postedAmount: result.eraEobProcessing.postedAmount,
      unmatchedAmount: result.eraEobProcessing.unmatchedAmount,
      accountingLocked: result.eraEobProcessing.accountingLocked,
      exceptionReason: result.eraEobProcessing.exceptionReason,
    },
    paymentPostings: result.paymentPostings.map((posting: any) => ({
      id: String(posting._id),
      claimId: String(posting.claimId ?? ''),
      postingStatus: posting.postingStatus,
      postedAmount: posting.postedAmount,
      patientResponsibilityAmount: posting.patientResponsibilityAmount,
      remainingBalance: posting.remainingBalance,
      paymentLineCount: posting.paymentLines?.length ?? 0,
    })),
    matchedClaims: result.matchedClaims,
    unmatchedClaims: result.unmatchedClaims,
    parseErrors: result.parseErrors,
    importErrors: result.importErrors,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('ERA 835 import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
