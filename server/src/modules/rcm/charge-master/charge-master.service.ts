import { ChargeMaster } from './charge-master.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Types } from 'mongoose';

const CPT_CODE_PATTERN = /^[A-Z0-9]{5}$/i;
const REVENUE_CODE_PATTERN = /^\d{4}$/;
const PLACE_OF_SERVICE_PATTERN = /^\d{2}$/;
const MODIFIER_PATTERN = /^[A-Z0-9]{2}$/i;
const ICD_10_CODE_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeUppercaseText(value: unknown) {
  const normalizedValue = normalizeText(value)?.toUpperCase();
  return normalizedValue || undefined;
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

function normalizeDateArrayRange(start?: Date, end?: Date) {
  return {
    start: start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : undefined,
    end: end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : undefined,
  };
}

function rangesOverlap(
  leftStart?: Date,
  leftEnd?: Date,
  rightStart?: Date,
  rightEnd?: Date
) {
  const left = normalizeDateArrayRange(leftStart, leftEnd);
  const right = normalizeDateArrayRange(rightStart, rightEnd);
  const effectiveLeftStart = left.start?.getTime() ?? Number.NEGATIVE_INFINITY;
  const effectiveLeftEnd = left.end?.getTime() ?? Number.POSITIVE_INFINITY;
  const effectiveRightStart = right.start?.getTime() ?? Number.NEGATIVE_INFINITY;
  const effectiveRightEnd = right.end?.getTime() ?? Number.POSITIVE_INFINITY;

  return effectiveLeftStart <= effectiveRightEnd && effectiveRightStart <= effectiveLeftEnd;
}

function isChargeMasterActiveOnDate(item: any, serviceDate?: Date) {
  if (!serviceDate) {
    return true;
  }

  const targetDate = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate());
  const effectiveDate = normalizeDate(item?.effectiveDate);
  const terminationDate = normalizeDate(item?.terminationDate);
  const normalizedEffectiveDate = effectiveDate
    ? new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate())
    : undefined;
  const normalizedTerminationDate = terminationDate
    ? new Date(terminationDate.getFullYear(), terminationDate.getMonth(), terminationDate.getDate())
    : undefined;

  if (normalizedEffectiveDate && normalizedEffectiveDate.getTime() > targetDate.getTime()) {
    return false;
  }

  if (normalizedTerminationDate && normalizedTerminationDate.getTime() < targetDate.getTime()) {
    return false;
  }

  return true;
}

function sanitizeChargeMasterData(data: any) {
  const sanitizedData = { ...data };

  if (data.cptCode !== undefined) {
    sanitizedData.cptCode = normalizeUppercaseText(data.cptCode);
  }

  if (data.description !== undefined) {
    sanitizedData.description = normalizeText(data.description);
  }

  if (data.revenueCode !== undefined) {
    sanitizedData.revenueCode = normalizeText(data.revenueCode);
  }

  if (data.placeOfService !== undefined) {
    sanitizedData.placeOfService = normalizeText(data.placeOfService);
  }

  if (data.modifiersAllowed !== undefined) {
    sanitizedData.modifiersAllowed = Array.isArray(data.modifiersAllowed)
      ? data.modifiersAllowed
          .map((value: unknown) => normalizeUppercaseText(value))
          .filter((value: string | undefined): value is string => Boolean(value))
      : [];
  }

  if (data.diagnosisRestrictions !== undefined) {
    sanitizedData.diagnosisRestrictions = Array.isArray(data.diagnosisRestrictions)
      ? data.diagnosisRestrictions
          .map((value: unknown) => normalizeUppercaseText(value))
          .filter((value: string | undefined): value is string => Boolean(value))
      : [];
  }

  if (data.effectiveDate !== undefined) {
    sanitizedData.effectiveDate = normalizeDate(data.effectiveDate);
  }

  if (data.terminationDate !== undefined) {
    sanitizedData.terminationDate = normalizeDate(data.terminationDate);
  }

  return sanitizedData;
}

async function validateChargeMasterData(data: any, locale: string, currentId?: string) {
  void locale;
  const cptCode = normalizeUppercaseText(data.cptCode);
  const description = normalizeText(data.description);
  const placeOfService = normalizeText(data.placeOfService);
  const revenueCode = normalizeText(data.revenueCode);
  const effectiveDate = normalizeDate(data.effectiveDate);
  const terminationDate = normalizeDate(data.terminationDate);
  const defaultChargeAmount =
    typeof data.defaultChargeAmount === 'number' ? data.defaultChargeAmount : undefined;
  const defaultAllowedAmount =
    typeof data.defaultAllowedAmount === 'number' ? data.defaultAllowedAmount : undefined;

  if (!cptCode || !CPT_CODE_PATTERN.test(cptCode)) {
    throw new AppError('CPT/HCPCS code must be a valid 5-character code.', HTTP_STATUS.BAD_REQUEST);
  }

  if (!description) {
    throw new AppError('Charge master description is required.', HTTP_STATUS.BAD_REQUEST);
  }

  if (!placeOfService || !PLACE_OF_SERVICE_PATTERN.test(placeOfService)) {
    throw new AppError('Place of service must be a valid 2-digit code.', HTTP_STATUS.BAD_REQUEST);
  }

  if (revenueCode && !REVENUE_CODE_PATTERN.test(revenueCode)) {
    throw new AppError('Revenue code must be a valid 4-digit code.', HTTP_STATUS.BAD_REQUEST);
  }

  if (!(effectiveDate instanceof Date) || Number.isNaN(effectiveDate.getTime())) {
    throw new AppError('Effective date is required.', HTTP_STATUS.BAD_REQUEST);
  }

  if (
    terminationDate instanceof Date
    && !Number.isNaN(terminationDate.getTime())
    && terminationDate.getTime() < effectiveDate.getTime()
  ) {
    throw new AppError('Termination date must be on or after the effective date.', HTTP_STATUS.BAD_REQUEST);
  }

  if (typeof defaultChargeAmount !== 'number' || !Number.isFinite(defaultChargeAmount) || defaultChargeAmount <= 0) {
    throw new AppError('Default charge amount must be greater than 0.', HTTP_STATUS.BAD_REQUEST);
  }

  if (
    defaultAllowedAmount !== undefined
    && (!Number.isFinite(defaultAllowedAmount) || defaultAllowedAmount < 0)
  ) {
    throw new AppError('Default allowed amount must be 0 or greater.', HTTP_STATUS.BAD_REQUEST);
  }

  if (
    defaultAllowedAmount !== undefined
    && defaultAllowedAmount > defaultChargeAmount
  ) {
    throw new AppError('Default allowed amount should not exceed the default charge amount.', HTTP_STATUS.BAD_REQUEST);
  }

  const modifiersAllowed = Array.isArray(data.modifiersAllowed) ? data.modifiersAllowed : [];
  const invalidModifier = modifiersAllowed.find((value: unknown) => !MODIFIER_PATTERN.test(String(value).trim()));
  if (invalidModifier) {
    throw new AppError(`Modifier ${String(invalidModifier).trim()} must be a valid 2-character value.`, HTTP_STATUS.BAD_REQUEST);
  }

  const diagnosisRestrictions = Array.isArray(data.diagnosisRestrictions) ? data.diagnosisRestrictions : [];
  const invalidDiagnosisRestriction = diagnosisRestrictions.find(
    (value: unknown) => !ICD_10_CODE_PATTERN.test(String(value).trim())
  );
  if (invalidDiagnosisRestriction) {
    throw new AppError(
      `Diagnosis restriction ${String(invalidDiagnosisRestriction).trim()} must be a valid ICD-10 code.`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const isActive = data.active ?? true;
  if (!isActive) {
    return;
  }

  const overlappingItems = await ChargeMaster.find({
    _id: currentId && Types.ObjectId.isValid(currentId) ? { $ne: new Types.ObjectId(currentId) } : { $exists: true },
    cptCode,
    placeOfService,
    active: true,
    isDeleted: false,
  })
    .select('_id effectiveDate terminationDate')
    .lean();

  const conflictingItem = overlappingItems.find((item) =>
    rangesOverlap(
      effectiveDate,
      terminationDate,
      normalizeDate(item.effectiveDate),
      normalizeDate(item.terminationDate)
    )
  );

  if (conflictingItem) {
    throw new AppError(
      `An active charge master already exists for CPT/HCPCS ${cptCode} and POS ${placeOfService} during the selected effective period.`,
      HTTP_STATUS.CONFLICT
    );
  }
}

function rankApplicableChargeMasters(
  items: any[],
  serviceDate?: Date,
  placeOfService?: string
) {
  const normalizedPos = normalizeText(placeOfService);

  return items
    .filter((item) => isChargeMasterActiveOnDate(item, serviceDate))
    .filter((item) => {
      if (!normalizedPos) {
        return true;
      }

      const itemPos = normalizeText(item.placeOfService);
      return !itemPos || itemPos === normalizedPos;
    })
    .sort((left, right) => {
      const leftPos = normalizeText(left.placeOfService);
      const rightPos = normalizeText(right.placeOfService);
      const leftPosRank = normalizedPos && leftPos === normalizedPos ? 2 : leftPos ? 0 : 1;
      const rightPosRank = normalizedPos && rightPos === normalizedPos ? 2 : rightPos ? 0 : 1;

      if (leftPosRank !== rightPosRank) {
        return rightPosRank - leftPosRank;
      }

      const leftEffectiveDate = normalizeDate(left.effectiveDate)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const rightEffectiveDate = normalizeDate(right.effectiveDate)?.getTime() ?? Number.NEGATIVE_INFINITY;

      if (leftEffectiveDate !== rightEffectiveDate) {
        return rightEffectiveDate - leftEffectiveDate;
      }

      const leftUpdated = normalizeDate(left.updated)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const rightUpdated = normalizeDate(right.updated)?.getTime() ?? Number.NEGATIVE_INFINITY;

      return rightUpdated - leftUpdated;
    });
}

export const chargeMasterService = {
  async create(data: any, locale: string, createdBy: string) {
    const sanitizedData = sanitizeChargeMasterData(data);
    await validateChargeMasterData(sanitizedData, locale);

    const item = await ChargeMaster.create({
      ...sanitizedData,
      active: sanitizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await ChargeMaster.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('chargeMaster.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await ChargeMaster.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('chargeMaster.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const sanitizedData = sanitizeChargeMasterData(data);
    const candidate = {
      ...item.toObject(),
      ...sanitizedData,
    };

    await validateChargeMasterData(candidate, locale, id);

    Object.assign(item, {
      ...sanitizedData,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await ChargeMaster.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('chargeMaster.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async getByCptCode(
    cptCode: string,
    locale: string,
    options?: {
      serviceDate?: Date | string;
      placeOfService?: string;
    }
  ) {
    void locale;
    const normalizedCode = normalizeUppercaseText(cptCode);
    if (!normalizedCode) {
      return null;
    }

    const items = await ChargeMaster.find({
      cptCode: normalizedCode,
      active: true,
      isDeleted: false,
    });
    const serviceDate = normalizeDate(options?.serviceDate);
    const rankedItems = rankApplicableChargeMasters(items, serviceDate, options?.placeOfService);

    return rankedItems[0] ?? null;
  },

  async listApplicableProcedureCandidates(options?: {
    serviceDate?: Date | string;
    placeOfService?: string;
  }) {
    const items = await ChargeMaster.find({
      active: true,
      isDeleted: false,
      cptCode: { $exists: true, $ne: null },
    })
      .select('cptCode description placeOfService defaultChargeAmount modifiersAllowed diagnosisRestrictions effectiveDate terminationDate updated')
      .lean();

    return rankApplicableChargeMasters(
      items,
      normalizeDate(options?.serviceDate),
      options?.placeOfService
    );
  },
};
