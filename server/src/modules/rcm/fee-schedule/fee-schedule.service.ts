import { FeeSchedule, IFeeSchedule } from './fee-schedule.model';
import { normalizeUsState } from '../shared/state-normalization';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

const SINGLE_CPT_CDT_ERROR = 'Only one CPT/CDT/HCPCS code allowed per fee schedule record';
const SINGLE_CPT_CDT_PATTERN = /^[A-Z0-9]{5}$/i;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeCode(value: unknown) {
  return normalizeText(value)?.toUpperCase();
}

function normalizeSingleProcedureCode(value: unknown) {
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new AppError(SINGLE_CPT_CDT_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const normalizedValue = value.trim().toUpperCase();

  if (!normalizedValue || /[,\s]/.test(normalizedValue) || !SINGLE_CPT_CDT_PATTERN.test(normalizedValue)) {
    throw new AppError(SINGLE_CPT_CDT_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  return normalizedValue;
}

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeCode(value))
    .filter((value): value is string => Boolean(value));
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

function normalizePayload(data: Partial<IFeeSchedule>): Partial<IFeeSchedule> {
  const normalizedData = { ...data };
  const cptCode = data.cptCode !== undefined ? normalizeSingleProcedureCode(data.cptCode) : undefined;
  const state = normalizeUsState(data.state);
  const placeOfServiceCode = normalizeText(data.placeOfServiceCode);
  const planName = normalizeText(data.planName);
  const groupNumber = normalizeText(data.groupNumber);
  const network = normalizeText(data.network);
  const coverageType = normalizeText(data.coverageType);
  const modifiers = normalizeStringArray(data.modifiers);

  if (data.cptCode !== undefined) normalizedData.cptCode = cptCode;
  if (data.modifiers !== undefined) normalizedData.modifiers = modifiers;
  if (data.state !== undefined) normalizedData.state = state;
  if (data.placeOfServiceCode !== undefined) normalizedData.placeOfServiceCode = placeOfServiceCode;
  if (data.planName !== undefined) normalizedData.planName = planName;
  if (data.groupNumber !== undefined) normalizedData.groupNumber = groupNumber;
  if (data.network !== undefined) normalizedData.network = network;
  if (data.coverageType !== undefined) normalizedData.coverageType = coverageType;

  return normalizedData;
}

function validateDateRange(data: Partial<IFeeSchedule>) {
  const effectiveDate = normalizeDate(data.effectiveDate);
  const expiryDate = normalizeDate(data.expiryDate);

  if (effectiveDate && expiryDate && expiryDate.getTime() < effectiveDate.getTime()) {
    throw new AppError('Expiry date must be on or after the effective date.', HTTP_STATUS.BAD_REQUEST);
  }
}

export type FeeScheduleLookupQuery = {
  payerIds: string[];
  cptCode: string;
  modifiers?: string[];
  providerId?: string;
  facilityId?: string;
  state?: string;
  placeOfServiceCode?: string;
  planName?: string;
  groupNumber?: string;
  network?: string;
  coverageType?: string;
  serviceDate?: Date | string;
};

export type FeeScheduleLookupResult = {
  feeSchedule: IFeeSchedule;
  allowedAmount: number;
  feeScheduleId: string;
  matchedBy: string;
  confidence: number;
  source: 'CONTRACT_RATE';
  effectiveDate?: Date;
  expiryDate?: Date;
};

export class FeeScheduleService {
  async create(data: Partial<IFeeSchedule>): Promise<IFeeSchedule> {
    const normalizedData = normalizePayload(data);
    validateDateRange(normalizedData);
    return await FeeSchedule.create(normalizedData);
  }

  async getById(id: string): Promise<IFeeSchedule | null> {
    return await FeeSchedule.findOne({ _id: id, isDeleted: false });
  }

  async update(id: string, data: Partial<IFeeSchedule>): Promise<IFeeSchedule | null> {
    const existing = await FeeSchedule.findOne({ _id: id, isDeleted: false });
    if (!existing) {
      return null;
    }

    const normalizedData = normalizePayload(data);
    validateDateRange({
      ...existing.toObject(),
      ...normalizedData,
    });

    return await FeeSchedule.findOneAndUpdate({ _id: id, isDeleted: false }, normalizedData, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await FeeSchedule.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );
    return !!result;
  }

  async list(criteria: any): Promise<{ data: IFeeSchedule[]; total: number }> {
    const filter = { ...criteria.filter, isDeleted: false };
    const [data, total] = await Promise.all([
      FeeSchedule.list({ ...criteria, filter }),
      FeeSchedule.totalCount({ filter }),
    ]);
    return { data, total };
  }

  async findExactMatch(query: {
    payerId: string;
    cptCode: string;
    providerId?: string;
    facilityId?: string;
    state?: string;
    placeOfServiceCode?: string;
    planName?: string;
    groupNumber?: string;
    network?: string;
    coverageType?: string;
  }): Promise<IFeeSchedule | null> {
    const filter: any = {
      payerId: query.payerId,
      cptCode: query.cptCode,
      isDeleted: false,
      active: true,
    };
    if (query.providerId) filter.providerId = query.providerId;
    if (query.facilityId) filter.facilityId = query.facilityId;
    if (query.state) filter.state = normalizeUsState(query.state);
    if (query.placeOfServiceCode) filter.placeOfServiceCode = normalizeText(query.placeOfServiceCode);
    if (query.planName) filter.planName = normalizeText(query.planName);
    if (query.groupNumber) filter.groupNumber = normalizeText(query.groupNumber);
    if (query.network) filter.network = normalizeText(query.network);
    if (query.coverageType) filter.coverageType = normalizeText(query.coverageType);

    return await FeeSchedule.findOne(filter).sort({ effectiveDate: -1 });
  }

  async findBestMatch(query: {
    payerIds: string[];
    cptCode: string;
    modifiers?: string[];
    providerId?: string;
    facilityId?: string;
    state?: string;
    placeOfServiceCode?: string;
    planName?: string;
    groupNumber?: string;
    network?: string;
    coverageType?: string;
    serviceDate?: Date | string;
  }): Promise<IFeeSchedule | null> {
    return (await this.findBestMatchDetailed(query))?.feeSchedule ?? null;
  }

  async findBestMatchDetailed(query: FeeScheduleLookupQuery): Promise<FeeScheduleLookupResult | null> {
    const payerIds = Array.from(new Set(query.payerIds.map(normalizeText).filter((value): value is string => Boolean(value))));
    const cptCode = normalizeSingleProcedureCode(query.cptCode);

    if (!payerIds.length || !cptCode) {
      return null;
    }

    const serviceDate = normalizeDate(query.serviceDate) ?? new Date();
    const providerId = normalizeText(query.providerId);
    const facilityId = normalizeText(query.facilityId);
    const state = normalizeUsState(query.state);
    const placeOfServiceCode = normalizeText(query.placeOfServiceCode);
    const planName = normalizeText(query.planName);
    const groupNumber = normalizeText(query.groupNumber);
    const network = normalizeText(query.network);
    const coverageType = normalizeText(query.coverageType);
    const modifiers = normalizeStringArray(query.modifiers);

    const candidates = await FeeSchedule.find({
      payerId: { $in: payerIds },
      cptCode,
      active: true,
      isDeleted: false,
      $and: [
        { $or: [{ effectiveDate: { $exists: false } }, { effectiveDate: null }, { effectiveDate: { $lte: serviceDate } }] },
        { $or: [{ expiryDate: { $exists: false } }, { expiryDate: null }, { expiryDate: { $gte: serviceDate } }] },
        { $or: [{ providerId: providerId ? providerId : { $exists: false } }, { providerId: { $exists: false } }, { providerId: null }] },
        { $or: [{ facilityId: facilityId ? facilityId : { $exists: false } }, { facilityId: { $exists: false } }, { facilityId: null }] },
        { $or: [{ state: state ? state : { $exists: false } }, { state: { $exists: false } }, { state: null }, { state: '' }] },
        { $or: [{ placeOfServiceCode: placeOfServiceCode ? placeOfServiceCode : { $exists: false } }, { placeOfServiceCode: { $exists: false } }, { placeOfServiceCode: null }, { placeOfServiceCode: '' }] },
        { $or: [{ planName: planName ? planName : { $exists: false } }, { planName: { $exists: false } }, { planName: null }, { planName: '' }] },
        { $or: [{ groupNumber: groupNumber ? groupNumber : { $exists: false } }, { groupNumber: { $exists: false } }, { groupNumber: null }, { groupNumber: '' }] },
        { $or: [{ network: network ? network : { $exists: false } }, { network: { $exists: false } }, { network: null }, { network: '' }] },
        { $or: [{ coverageType: coverageType ? coverageType : { $exists: false } }, { coverageType: { $exists: false } }, { coverageType: null }, { coverageType: '' }] },
      ],
    }).sort({ effectiveDate: -1, updated: -1 });

    const modifierMatches = (candidate: IFeeSchedule) => {
      const candidateModifiers = normalizeStringArray(candidate.modifiers);
      if (!candidateModifiers.length) {
        return true;
      }

      return candidateModifiers.every((modifier) => modifiers.includes(modifier));
    };

    const hasProvider = (candidate: IFeeSchedule) => providerId && String(candidate.providerId ?? '') === providerId;
    const hasFacility = (candidate: IFeeSchedule) => facilityId && String(candidate.facilityId ?? '') === facilityId;
    const hasState = (candidate: IFeeSchedule) => state && normalizeUsState(candidate.state) === state;
    const hasPos = (candidate: IFeeSchedule) => placeOfServiceCode && normalizeText(candidate.placeOfServiceCode) === placeOfServiceCode;
    const hasPlan = (candidate: IFeeSchedule) => planName && normalizeText(candidate.planName) === planName;
    const hasGroup = (candidate: IFeeSchedule) => groupNumber && normalizeText(candidate.groupNumber) === groupNumber;
    const hasNetwork = (candidate: IFeeSchedule) => network && normalizeText(candidate.network) === network;
    const hasCoverageType = (candidate: IFeeSchedule) => coverageType && normalizeText(candidate.coverageType) === coverageType;
    const hasModifiers = (candidate: IFeeSchedule) => normalizeStringArray(candidate.modifiers).length > 0 && modifierMatches(candidate);

    const tier = (candidate: IFeeSchedule) => {
      if (hasProvider(candidate) && hasFacility(candidate) && hasState(candidate) && hasPos(candidate) && hasPlan(candidate) && hasGroup(candidate) && hasNetwork(candidate)) {
        return { rank: 8, matchedBy: 'payer-provider-facility-cpt-state-pos-plan-group-network', confidence: 100 };
      }
      if (hasProvider(candidate) && hasState(candidate) && hasPos(candidate) && hasPlan(candidate) && hasGroup(candidate)) {
        return { rank: 7, matchedBy: 'payer-provider-cpt-state-pos-plan-group', confidence: 98 };
      }
      if (hasProvider(candidate) && hasState(candidate) && hasPos(candidate)) {
        return { rank: 6, matchedBy: 'payer-provider-cpt-state-pos', confidence: 96 };
      }
      if (hasFacility(candidate) && hasState(candidate) && hasPos(candidate)) {
        return { rank: 5, matchedBy: 'payer-facility-cpt-state-pos', confidence: 94 };
      }
      if (hasState(candidate) && hasPos(candidate)) {
        return { rank: 4, matchedBy: 'payer-cpt-state-pos', confidence: 92 };
      }
      if (hasPos(candidate)) {
        return { rank: 3, matchedBy: 'payer-cpt-pos', confidence: 88 };
      }
      return { rank: 2, matchedBy: 'payer-cpt', confidence: 82 };
    };

    const filteredCandidates = candidates.filter(modifierMatches);

    const score = (candidate: IFeeSchedule) => {
      const currentTier = tier(candidate);
      let value = currentTier.rank * 1000;
      if (hasCoverageType(candidate)) value += 80;
      if (hasModifiers(candidate)) value += 60;
      if (hasNetwork(candidate)) value += 40;
      if (hasGroup(candidate)) value += 30;
      if (hasPlan(candidate)) value += 20;
      const payerPriority = payerIds.indexOf(candidate.payerId);
      value += payerPriority >= 0 ? (payerIds.length - payerPriority) / 100 : 0;
      return value;
    };

    const feeSchedule = filteredCandidates.sort((left, right) => {
      const scoreDelta = score(right) - score(left);
      if (scoreDelta !== 0) return scoreDelta;
      return (right.effectiveDate?.getTime() ?? 0) - (left.effectiveDate?.getTime() ?? 0);
    })[0] ?? null;

    if (!feeSchedule) {
      return null;
    }

    const matchTier = tier(feeSchedule);

    return {
      feeSchedule,
      allowedAmount: feeSchedule.allowedAmount,
      feeScheduleId: String(feeSchedule._id),
      matchedBy: matchTier.matchedBy,
      confidence: Math.min(100, matchTier.confidence + (hasCoverageType(feeSchedule) ? 1 : 0) + (hasModifiers(feeSchedule) ? 1 : 0)),
      source: 'CONTRACT_RATE',
      effectiveDate: feeSchedule.effectiveDate,
      expiryDate: feeSchedule.expiryDate,
    };
  }
}

export const feeScheduleService = new FeeScheduleService();
