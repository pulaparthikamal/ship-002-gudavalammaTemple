import { Charge } from './charge.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import {
  CHARGE_CODING_REVIEW_STATUS_OPTIONS,
  CHARGE_STATUS_OPTIONS,
} from './charge.constants';
import { appendStatusHistory } from '../workflow/workflow-history';
import { Encounter } from '../encounter/encounter.model';
import { Facility } from '../facility/facility.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { Claim } from '../claim/claim.model';
import { codingReviewService } from '../coding-review/coding-review.service';
import { chargeMasterService } from '../charge-master/charge-master.service';
import type { ClientSession } from 'mongoose';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const nextValues = values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  return nextValues.length ? nextValues : [];
}

function normalizeNumberArray(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const nextValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return nextValues.length ? nextValues : [];
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function sumChargeLines(chargeLines: Array<Record<string, any>> = []) {
  return chargeLines.reduce((total, line) => total + (line.chargeAmount ?? 0), 0);
}

function normalizeLineForLockComparison(line: any = {}) {
  return {
    cptCode: normalizeText(line.cptCode)?.toUpperCase() ?? '',
    icdCodes: (line.icdCodes ?? []).map((code: unknown) => normalizeText(code)?.toUpperCase()).filter(Boolean),
    icdPointers: (line.icdPointers ?? []).filter((pointer: unknown) => typeof pointer === 'number' && Number.isFinite(pointer)),
    modifiers: (line.modifiers ?? []).map((modifier: unknown) => normalizeText(modifier)?.toUpperCase()).filter(Boolean),
    units: typeof line.units === 'number' ? line.units : undefined,
    chargeAmount: typeof line.chargeAmount === 'number' ? line.chargeAmount : undefined,
    renderingProviderId: normalizeText(line.renderingProviderId?.toString?.() ?? line.renderingProviderId) ?? '',
  };
}

function chargeLinesChanged(previousLines: any[] = [], nextLines: any[] = []) {
  return JSON.stringify(previousLines.map(normalizeLineForLockComparison))
    !== JSON.stringify(nextLines.map(normalizeLineForLockComparison));
}

function normalizeComparableValue(value: any) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value?.toString && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return value.toString();
  }

  return value;
}

function protectedChargeHeaderChanged(item: any, normalizedData: any, candidate: any) {
  const protectedFields = [
    'encounterId',
    'patientId',
    'providerId',
    'facilityId',
    'serviceDate',
    'placeOfService',
  ];

  return protectedFields.some((field) => {
    if (normalizedData[field] === undefined) {
      return false;
    }

    return normalizeComparableValue(item[field]) !== normalizeComparableValue(candidate[field]);
  });
}

function isChargeMutationLocked(item: any, linkedClaim: unknown) {
  return Boolean(linkedClaim)
    || item.chargeStatus === 'Approved'
    || item.codingReviewStatus === 'Approved for Claim'
    || item.codingReviewStatus === 'Pending'
    || item.codingReviewStatus === 'Passed';
}

function normalizeChargeLines(chargeLines: unknown) {
  if (!Array.isArray(chargeLines)) {
    return undefined;
  }

  return chargeLines.map((line, index) => ({
    lineNumber: typeof line?.lineNumber === 'number' ? line.lineNumber : index + 1,
    cptCode: normalizeText(line?.cptCode),
    icdCodes: normalizeStringArray(line?.icdCodes) ?? [],
    icdPointers: normalizeNumberArray(line?.icdPointers) ?? [],
    modifiers: normalizeStringArray(line?.modifiers) ?? [],
    units: typeof line?.units === 'number' ? line.units : undefined,
    chargeAmount: typeof line?.chargeAmount === 'number' ? line.chargeAmount : undefined,
    diagnosisLinking: normalizeText(line?.diagnosisLinking),
    renderingProviderId: normalizeText(line?.renderingProviderId),
  }));
}

function normalizeChargeData(data: any) {
  const normalizedData = { ...data };

  if (data.serviceDate !== undefined) {
    normalizedData.serviceDate = normalizeDate(data.serviceDate);
  }

  if (data.placeOfService !== undefined) {
    normalizedData.placeOfService = normalizeText(data.placeOfService);
  }

  if (data.chargeStatus !== undefined) {
    normalizedData.chargeStatus = normalizeText(data.chargeStatus);
  }

  if (data.codingReviewStatus !== undefined) {
    normalizedData.codingReviewStatus = normalizeText(data.codingReviewStatus);
  }

  if (data.createdBy !== undefined) {
    normalizedData.createdBy = normalizeText(data.createdBy);
  }

  if (data.reviewedBy !== undefined) {
    normalizedData.reviewedBy = normalizeText(data.reviewedBy);
  }

  if (data.validationErrors !== undefined) {
    normalizedData.validationErrors = normalizeStringArray(data.validationErrors) ?? [];
  }

  if (data.chargeLines !== undefined) {
    normalizedData.chargeLines = normalizeChargeLines(data.chargeLines) ?? [];
  }

  if (normalizedData.chargeLines) {
    normalizedData.totalChargeAmount = sumChargeLines(normalizedData.chargeLines);
  }

  return normalizedData;
}

function mergeChargeState(currentItem: any, nextData: any) {
  return {
    ...currentItem,
    ...nextData,
    validationErrors: nextData.validationErrors ?? currentItem.validationErrors ?? [],
    chargeLines: nextData.chargeLines ?? currentItem.chargeLines ?? [],
  };
}

function validateChargeState(candidate: any) {
  if (!candidate.encounterId || !candidate.patientId || !candidate.providerId || !candidate.facilityId) {
    throw buildValidationError('Encounter, patient, provider, and facility are required for charge capture.');
  }

  if (!(candidate.serviceDate instanceof Date) || Number.isNaN(candidate.serviceDate.getTime())) {
    throw buildValidationError('Service date is required for charge capture.');
  }

  if (!candidate.placeOfService) {
    throw buildValidationError('Place of service is required for charge capture.');
  }

  if (!Array.isArray(candidate.chargeLines) || !candidate.chargeLines.length) {
    throw buildValidationError('At least one charge line is required for charge capture.');
  }

  for (const [index, line] of candidate.chargeLines.entries()) {
    const lineNumber = line.lineNumber ?? index + 1;

    if (!normalizeText(line.cptCode)) {
      throw buildValidationError(`Charge line ${lineNumber} requires a CPT/CDT code.`);
    }

    if (!line.icdCodes?.length) {
      throw buildValidationError(`Charge line ${lineNumber} requires at least one diagnosis code.`);
    }

    if (!line.icdPointers?.length) {
      throw buildValidationError(`Charge line ${lineNumber} requires diagnosis pointers.`);
    }

    if (typeof line.units !== 'number' || !Number.isFinite(line.units) || line.units <= 0) {
      throw buildValidationError(`Charge line ${lineNumber} requires units greater than 0.`);
    }

    if (typeof line.chargeAmount !== 'number' || !Number.isFinite(line.chargeAmount) || line.chargeAmount <= 0) {
      throw buildValidationError(`Charge line ${lineNumber} requires a valid ChargeMaster amount.`);
    }

    if (!normalizeText(line.renderingProviderId?.toString?.() ?? line.renderingProviderId)) {
      throw buildValidationError(`Charge line ${lineNumber} requires a rendering provider.`);
    }
  }

  if (typeof candidate.totalChargeAmount !== 'number' || !Number.isFinite(candidate.totalChargeAmount) || candidate.totalChargeAmount <= 0) {
    throw buildValidationError('Total charge amount must be greater than 0.');
  }

  if (candidate.chargeStatus && !CHARGE_STATUS_OPTIONS.includes(candidate.chargeStatus)) {
    throw buildValidationError('Charge status is invalid.');
  }

  if (
    candidate.codingReviewStatus
      && !CHARGE_CODING_REVIEW_STATUS_OPTIONS.includes(candidate.codingReviewStatus)
  ) {
    throw buildValidationError('Coding review status is invalid.');
  }
}

async function enforceChargeLineLockIfNeeded(item: any, candidate: any) {
  if (!chargeLinesChanged(item.chargeLines ?? [], candidate.chargeLines ?? [])) {
    return;
  }

  const [approvedCodingReview, linkedClaim] = await Promise.all([
    CodingReview.exists({
      chargeId: item._id,
      scrubStatus: 'Approved',
      isDeleted: false,
    }),
    Claim.exists({
      chargeId: item._id,
      isDeleted: false,
    }),
  ]);

  if (approvedCodingReview || linkedClaim) {
    throw buildValidationError(
      'Charge lines are locked after approved coding review or claim creation. Use a correction/regeneration workflow instead of editing CPT, modifiers, ICD pointers, units, or billed amounts.'
    );
  }
}

async function enforceProtectedChargeMutationIfNeeded(item: any, normalizedData: any, candidate: any) {
  const linkedClaim = await Claim.exists({
    chargeId: item._id,
    isDeleted: false,
  });

  if (!isChargeMutationLocked(item, linkedClaim)) {
    return;
  }

  if (
    protectedChargeHeaderChanged(item, normalizedData, candidate)
    || (
      normalizedData.chargeLines !== undefined
      && chargeLinesChanged(item.chargeLines ?? [], candidate.chargeLines ?? [])
    )
  ) {
    throw buildValidationError(
      'Submitted, priced, approved, or claim-linked charges cannot be changed through generic edit. Use the correction/regeneration workflow instead.'
    );
  }
}

async function applyChargeMasterPricing(candidate: any, locale: string) {
  const serviceDate = normalizeDate(candidate.serviceDate);
  const placeOfService = normalizeText(candidate.placeOfService);

  if (!candidate.chargeLines?.length) {
    return candidate;
  }

  if (!placeOfService) {
    throw buildValidationError('Place of service is required before ChargeMaster pricing can be applied.');
  }

  for (const [index, line] of candidate.chargeLines.entries()) {
    const lineNumber = line.lineNumber ?? index + 1;
    const cptCode = normalizeText(line.cptCode)?.toUpperCase();

    if (!cptCode) {
      continue;
    }

    const units = typeof line.units === 'number' && line.units > 0 ? line.units : 1;
    const chargeMasterEntry = await chargeMasterService.getByCptCode(cptCode, locale, {
      serviceDate,
      placeOfService,
    });

    if (!chargeMasterEntry) {
      throw buildValidationError('CPT/CDT must exist in active ChargeMaster.');
    }

    if (
      typeof chargeMasterEntry.defaultChargeAmount !== 'number'
      || !Number.isFinite(chargeMasterEntry.defaultChargeAmount)
      || chargeMasterEntry.defaultChargeAmount <= 0
    ) {
      throw buildValidationError(`ChargeMaster setup for CPT/CDT ${cptCode} is missing a valid default charge amount.`);
    }

    if (!line.icdPointers?.length || !line.icdCodes?.length) {
      throw buildValidationError(`Charge line ${lineNumber} must explicitly include linked diagnosis codes and ICD pointers.`);
    }

    line.cptCode = cptCode;
    line.units = units;
    line.chargeAmount = chargeMasterEntry.defaultChargeAmount * units;
    line.pricingStatus = 'CHARGEMASTER_PRICED';
    line.pricingMessage = `Billed amount matched active ChargeMaster CPT/CDT ${cptCode} for POS ${placeOfService}.`;
  }

  candidate.totalChargeAmount = sumChargeLines(candidate.chargeLines);
  return candidate;
}

function assertManualChargeWorkflowStatusAllowed(previousCharge: any, nextCharge: any) {
  const previousChargeStatus = previousCharge?.chargeStatus;
  const nextChargeStatus = nextCharge?.chargeStatus;
  const previousCodingReviewStatus = previousCharge?.codingReviewStatus;
  const nextCodingReviewStatus = nextCharge?.codingReviewStatus;

  if (
    nextChargeStatus
    && nextChargeStatus !== previousChargeStatus
    && nextChargeStatus !== 'Draft'
  ) {
    throw buildValidationError(
      'Use the Submit for Coding Review workflow action instead of manually setting charge status.'
    );
  }

  if (
    nextCodingReviewStatus
    && nextCodingReviewStatus !== previousCodingReviewStatus
    && nextCodingReviewStatus !== 'Not Started'
  ) {
    throw buildValidationError(
      'Coding review status is system-managed. Submit the charge for coding review instead of editing it manually.'
    );
  }
}

function validateEncounterReadyForChargeCapture(encounter: any) {
  const status = normalizeText(encounter.visitStatus);

  if (!['Completed', 'Checked Out', 'Ready for Charge Capture'].includes(status ?? '')) {
    throw buildValidationError('Encounter must be completed before charge capture can be generated.');
  }
}

async function buildChargeDraftFromEncounter(encounter: any, locale: string) {
  const facility = encounter.facilityId
    ? await Facility.findOne({ _id: encounter.facilityId, isDeleted: false })
    : null;
  const serviceDate = normalizeDate(encounter.encounterDate) ?? new Date();
  const placeOfService = normalizeText(facility?.placeOfServiceCode);
  const procedureCodes = normalizeStringArray(encounter.procedureCodes) ?? [];
  const diagnosisCodes = normalizeStringArray(encounter.diagnosisCodes) ?? [];
  const validationErrors: string[] = [];
  const rawProcedureCodeUnitEntries: Array<[string, unknown]> =
    encounter.procedureCodeUnits instanceof Map
      ? Array.from(encounter.procedureCodeUnits.entries()) as Array<[string, unknown]>
      : encounter.procedureCodeUnits && typeof encounter.procedureCodeUnits === 'object'
        ? Object.entries(encounter.procedureCodeUnits) as Array<[string, unknown]>
        : [];
  const procedureCodeUnits =
    rawProcedureCodeUnitEntries.reduce<Record<string, number>>((accumulator, [key, rawValue]) => {
      const normalizedCode = normalizeText(key)?.toUpperCase();
      const normalizedUnits =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string'
            ? Number(rawValue)
            : NaN;

      if (!normalizedCode || !Number.isFinite(normalizedUnits) || normalizedUnits <= 0) {
        return accumulator;
      }

      accumulator[normalizedCode] = normalizedUnits;
      return accumulator;
    }, {});

  if (!procedureCodes.length) {
    throw buildValidationError('Encounter must include at least one procedure code before charge capture.');
  }

  if (!placeOfService) {
    throw buildValidationError('Facility place of service is required before charge capture can be generated.');
  }

  if (!diagnosisCodes.length) {
    throw buildValidationError('Encounter must include at least one diagnosis code before charge capture.');
  }

  const defaultLinkedDiagnosisCodes = diagnosisCodes.slice(0, 1);
  const defaultIcdPointers = [1];
  const renderingProviderId = encounter.renderingProviderId
    ? String(encounter.renderingProviderId)
    : encounter.providerId
      ? String(encounter.providerId)
      : undefined;

  const chargeLines = await Promise.all(
    procedureCodes.map(async (cptCode, index) => {
      const normalizedCptCode = normalizeText(cptCode)?.toUpperCase() ?? cptCode;
      const chargeMasterEntry = await chargeMasterService.getByCptCode(normalizedCptCode, locale, {
        serviceDate,
        placeOfService,
      });

      if (!chargeMasterEntry) {
        validationErrors.push(
          `No active charge master applies to CPT code ${normalizedCptCode} for POS ${placeOfService} on the encounter service date.`
        );
      }

      if (
        chargeMasterEntry
        && (
          typeof chargeMasterEntry.defaultChargeAmount !== 'number'
          || chargeMasterEntry.defaultChargeAmount <= 0
        )
      ) {
        validationErrors.push(
          `Charge master setup for CPT code ${normalizedCptCode} is missing a valid default charge amount.`
        );
      }

      return {
        lineNumber: index + 1,
        cptCode: normalizedCptCode,
        icdCodes: defaultLinkedDiagnosisCodes,
        icdPointers: defaultIcdPointers,
        modifiers: [],
        units: procedureCodeUnits[normalizedCptCode] ?? 1,
        chargeAmount: typeof chargeMasterEntry?.defaultChargeAmount === 'number'
          ? chargeMasterEntry.defaultChargeAmount * (procedureCodeUnits[normalizedCptCode] ?? 1)
          : undefined,
        pricingStatus: chargeMasterEntry ? 'CHARGEMASTER_PRICED' : 'MISSING_CHARGEMASTER',
        pricingMessage: chargeMasterEntry
          ? `Billed amount matched active ChargeMaster CPT/CDT ${normalizedCptCode} for POS ${placeOfService}.`
          : `No active ChargeMaster match found for CPT/CDT ${normalizedCptCode} and POS ${placeOfService}.`,
        renderingProviderId,
      };
    })
  );

  return {
    facility,
    serviceDate,
    placeOfService,
    chargeLines,
    totalChargeAmount: sumChargeLines(chargeLines),
    documentationComplete: Boolean(normalizeText(encounter.clinicalNotes) && diagnosisCodes.length),
    validationErrors,
  };
}

export const chargeService = {
  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizeChargeData(data);
    const candidate = {
      ...normalizedData,
      chargeStatus: normalizedData.chargeStatus ?? 'Draft',
      codingReviewStatus: normalizedData.codingReviewStatus ?? 'Not Started',
      documentationComplete: normalizedData.documentationComplete ?? false,
      validationErrors: normalizedData.validationErrors ?? [],
      chargeLines: normalizedData.chargeLines ?? [],
      totalChargeAmount: normalizedData.totalChargeAmount ?? 0,
    };

    assertManualChargeWorkflowStatusAllowed(undefined, candidate);
    await applyChargeMasterPricing(candidate, locale);
    validateChargeState(candidate);

    const item = await Charge.create({
      ...candidate,
      statusHistory: appendStatusHistory(undefined, candidate.chargeStatus, createdBy, 'Charge created'),
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdByUserId: createdBy,
    });

    return item;
  },

  async createFromEncounter(encounterId: string, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const session = options.session;
    const encounter = await Encounter.findOne({ _id: encounterId, isDeleted: false }).session(session ?? null);

    if (!encounter) {
      throw new AppError(t('encounter.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    validateEncounterReadyForChargeCapture(encounter);

    const existingCharge = await Charge.findOne({ encounterId, isDeleted: false }).session(session ?? null);
    const draftChargeData = await buildChargeDraftFromEncounter(encounter, locale);

    if (existingCharge) {
      if (
        existingCharge.chargeStatus === 'Approved'
        || existingCharge.codingReviewStatus === 'Approved for Claim'
      ) {
        return existingCharge;
      }

      const linkedClaim = await Claim.exists({ chargeId: existingCharge._id, isDeleted: false }).session(session ?? null);

      if (isChargeMutationLocked(existingCharge, linkedClaim)) {
        throw buildValidationError(
          'Submitted, priced, approved, or claim-linked charges cannot be regenerated from the encounter. Use the correction workflow instead.'
        );
      }

      const previousStatus = existingCharge.chargeStatus;
      Object.assign(existingCharge, {
        serviceDate: draftChargeData.serviceDate,
        placeOfService: draftChargeData.placeOfService,
        totalChargeAmount: draftChargeData.totalChargeAmount,
        documentationComplete: draftChargeData.documentationComplete,
        validationErrors: draftChargeData.validationErrors,
        chargeLines: draftChargeData.chargeLines,
        chargeStatus: 'Draft',
        codingReviewStatus: 'Not Started',
        statusHistory:
          previousStatus !== 'Draft'
            ? appendStatusHistory(
                existingCharge.statusHistory,
                'Draft',
                createdBy,
                'Charge refreshed from encounter updates'
              )
            : existingCharge.statusHistory,
        updatedByUserId: createdBy,
        updated: new Date(),
      });

      await existingCharge.save({ session });
      return existingCharge;
    }

    const [item] = await Charge.create([{
      encounterId: encounter._id,
      patientId: encounter.patientId,
      providerId: encounter.providerId,
      facilityId: encounter.facilityId,
      serviceDate: draftChargeData.serviceDate,
      placeOfService: draftChargeData.placeOfService,
      totalChargeAmount: draftChargeData.totalChargeAmount,
      chargeStatus: 'Draft',
      codingReviewStatus: 'Not Started',
      documentationComplete: draftChargeData.documentationComplete,
      validationErrors: draftChargeData.validationErrors,
      chargeLines: draftChargeData.chargeLines,
      statusHistory: appendStatusHistory(undefined, 'Draft', createdBy, 'Auto-created from completed encounter'),
      active: true,
      created: new Date(),
      updated: new Date(),
      createdByUserId: createdBy,
    }], { session });

    return item;
  },

  async prepareDraftFromEncounterData(encounter: any, locale: string) {
    return buildChargeDraftFromEncounter(encounter, locale);
  },

  async getById(id: string, locale: string) {
    const item = await Charge.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await Charge.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const previousStatus = item.chargeStatus;
    const normalizedData = normalizeChargeData(data);
    const candidate = mergeChargeState(item.toObject(), normalizedData);

    assertManualChargeWorkflowStatusAllowed(item.toObject(), candidate);
    if (normalizedData.chargeLines !== undefined) {
      await applyChargeMasterPricing(candidate, locale);
    }
    await enforceProtectedChargeMutationIfNeeded(item, normalizedData, candidate);
    await enforceChargeLineLockIfNeeded(item, candidate);
    validateChargeState(candidate);

    Object.assign(item, {
      ...normalizedData,
      chargeLines: candidate.chargeLines,
      totalChargeAmount:
        candidate.totalChargeAmount ?? sumChargeLines(candidate.chargeLines ?? item.chargeLines),
      statusHistory:
        normalizedData.chargeStatus && normalizedData.chargeStatus !== previousStatus
          ? appendStatusHistory(item.statusHistory, normalizedData.chargeStatus, updatedBy, 'Charge updated')
          : item.statusHistory,
      updatedByUserId: updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async submitForReview(id: string, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
    const item = await Charge.findOne({ _id: id, isDeleted: false }).session(session);

    if (!item) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    validateChargeState(item.toObject());

    item.chargeStatus = 'Submitted';
    item.codingReviewStatus = 'Pending';
    item.totalChargeAmount = sumChargeLines(item.chargeLines);
    item.statusHistory = appendStatusHistory(
      item.statusHistory,
      item.chargeStatus,
      updatedBy,
      'Submitted for coding review'
    );
    item.updatedByUserId = updatedBy;
    item.updated = new Date();

    await item.save({ session });

    const codingReview = await codingReviewService.createFromCharge(String(item._id), locale, updatedBy, {
      session,
      skipAiEnrichment: true,
    });

    item.codingReviewStatus =
      codingReview.scrubStatus === 'Approved' ? 'Approved for Claim' : codingReview.scrubStatus;

    item.validationErrors = codingReview.validationErrors ?? [];
    item.updated = new Date();
    await item.save({ session });

    return {
      charge: item,
      codingReview,
    };
    });
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const linkedCodingReview = await CodingReview.exists({ chargeId: id, isDeleted: false });
    const linkedClaim = await Claim.exists({ chargeId: id, isDeleted: false });

    const itemToDelete = await Charge.findOne({ _id: id, isDeleted: false });

    if (!itemToDelete) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (
      linkedCodingReview
      || linkedClaim
      || itemToDelete.chargeStatus !== 'Draft'
      || !['Not Started', 'Failed'].includes(itemToDelete.codingReviewStatus ?? '')
    ) {
      throw buildValidationError(
        'Submitted, coding-review, approved, or claim-linked charges cannot be deleted. Use a correction workflow instead.'
      );
    }

    const item = await Charge.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedByUserId: updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
