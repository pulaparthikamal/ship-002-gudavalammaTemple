import { Rule, IRule } from './rule.model';
import { normalizeUsState } from '../shared/state-normalization';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeCode(value: unknown) {
  return normalizeText(value)?.toUpperCase();
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

function normalizePayload(data: Partial<IRule>): Partial<IRule> {
  const normalizedData = { ...data };

  if (data.ruleId !== undefined) normalizedData.ruleId = normalizeText(data.ruleId) as string;
  if (data.type !== undefined) normalizedData.type = normalizeText(data.type) as string;
  if (data.message !== undefined) normalizedData.message = normalizeText(data.message) as string;
  if (data.severity !== undefined) normalizedData.severity = normalizeText(data.severity) as string;
  if (data.payerId !== undefined) normalizedData.payerId = normalizeText(data.payerId);
  if (data.state !== undefined) normalizedData.state = normalizeUsState(data.state);
  if (data.placeOfServiceCode !== undefined) normalizedData.placeOfServiceCode = normalizeText(data.placeOfServiceCode);
  if (data.planName !== undefined) normalizedData.planName = normalizeText(data.planName);
  if (data.groupNumber !== undefined) normalizedData.groupNumber = normalizeText(data.groupNumber);
  if (data.network !== undefined) normalizedData.network = normalizeText(data.network);
  if (data.coverageType !== undefined) normalizedData.coverageType = normalizeText(data.coverageType);
  if (data.code !== undefined) normalizedData.code = normalizeCode(data.code);
  if (data.codes !== undefined) {
    normalizedData.codes = data.codes
      .map((code) => normalizeCode(code))
      .filter((code): code is string => Boolean(code));
  }
  if (data.requiredFields !== undefined) {
    normalizedData.requiredFields = data.requiredFields
      .map((field) => normalizeText(field))
      .filter((field): field is string => Boolean(field));
  }

  return normalizedData;
}

export class RuleService {
  async create(data: Partial<IRule>): Promise<IRule> {
    return await Rule.create(normalizePayload(data));
  }

  async list(criteria: any): Promise<{ data: IRule[]; total: number }> {
    const filter = { ...criteria.filter, isDeleted: false };
    const [data, total] = await Promise.all([
      Rule.list({ ...criteria, filter }),
      Rule.totalCount({ filter }),
    ]);
    return { data, total };
  }

  async getById(id: string): Promise<IRule | null> {
    return await Rule.findOne({ _id: id, isDeleted: false });
  }

  async getByRuleId(ruleId: string): Promise<IRule | null> {
    return await Rule.findOne({ ruleId, isDeleted: false });
  }

  async update(id: string, data: Partial<IRule>): Promise<IRule | null> {
    return await Rule.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: normalizePayload(data) },
      { new: true }
    );
  }

  async findApplicable(query: {
    payerIds?: string[];
    cptCode?: string;
    providerId?: string;
    facilityId?: string;
    state?: string;
    placeOfServiceCode?: string;
    planName?: string;
    groupNumber?: string;
    network?: string;
    coverageType?: string;
    serviceDate?: Date | string;
  }): Promise<IRule[]> {
    const payerIds = Array.from(new Set((query.payerIds ?? []).map(normalizeText).filter((value): value is string => Boolean(value))));
    const cptCode = normalizeCode(query.cptCode);
    const serviceDate = normalizeDate(query.serviceDate) ?? new Date();
    const providerId = normalizeText(query.providerId);
    const facilityId = normalizeText(query.facilityId);
    const state = normalizeUsState(query.state);
    const placeOfServiceCode = normalizeText(query.placeOfServiceCode);
    const planName = normalizeText(query.planName);
    const groupNumber = normalizeText(query.groupNumber);
    const network = normalizeText(query.network);
    const coverageType = normalizeText(query.coverageType);

    const rules = await Rule.find({
      active: true,
      isDeleted: false,
      $and: [
        { $or: [{ effectiveDate: { $exists: false } }, { effectiveDate: null }, { effectiveDate: { $lte: serviceDate } }] },
        { $or: [{ expiryDate: { $exists: false } }, { expiryDate: null }, { expiryDate: { $gte: serviceDate } }] },
        {
          $or: payerIds.length
            ? [{ payerId: { $in: payerIds } }, { payerId: { $exists: false } }, { payerId: null }, { payerId: '' }]
            : [{ payerId: { $exists: false } }, { payerId: null }, { payerId: '' }],
        },
        { $or: [{ providerId: providerId ? providerId : { $exists: false } }, { providerId: { $exists: false } }, { providerId: null }] },
        { $or: [{ facilityId: facilityId ? facilityId : { $exists: false } }, { facilityId: { $exists: false } }, { facilityId: null }] },
        { $or: [{ state: state ? state : { $exists: false } }, { state: { $exists: false } }, { state: null }, { state: '' }] },
        { $or: [{ placeOfServiceCode: placeOfServiceCode ? placeOfServiceCode : { $exists: false } }, { placeOfServiceCode: { $exists: false } }, { placeOfServiceCode: null }, { placeOfServiceCode: '' }] },
        { $or: [{ planName: planName ? planName : { $exists: false } }, { planName: { $exists: false } }, { planName: null }, { planName: '' }] },
        { $or: [{ groupNumber: groupNumber ? groupNumber : { $exists: false } }, { groupNumber: { $exists: false } }, { groupNumber: null }, { groupNumber: '' }] },
        { $or: [{ network: network ? network : { $exists: false } }, { network: { $exists: false } }, { network: null }, { network: '' }] },
        { $or: [{ coverageType: coverageType ? coverageType : { $exists: false } }, { coverageType: { $exists: false } }, { coverageType: null }, { coverageType: '' }] },
        cptCode
          ? { $or: [{ code: cptCode }, { codes: cptCode }, { code: { $exists: false }, codes: { $exists: false } }] }
          : {},
      ],
    }).sort({ updated: -1 });

    const score = (rule: IRule) => {
      let value = 0;
      if (rule.payerId && payerIds.includes(rule.payerId)) value += 64;
      if (providerId && String(rule.providerId ?? '') === providerId) value += 32;
      if (facilityId && String(rule.facilityId ?? '') === facilityId) value += 16;
      if (state && normalizeUsState(rule.state) === state) value += 8;
      if (placeOfServiceCode && normalizeText(rule.placeOfServiceCode) === placeOfServiceCode) value += 4;
      if (planName && normalizeText(rule.planName) === planName) value += 128;
      if (groupNumber && normalizeText(rule.groupNumber) === groupNumber) value += 96;
      if (network && normalizeText(rule.network) === network) value += 48;
      if (coverageType && normalizeText(rule.coverageType) === coverageType) value += 24;
      if (cptCode && (normalizeCode(rule.code) === cptCode || rule.codes?.map(normalizeCode).includes(cptCode))) value += 2;
      return value;
    };

    return rules.sort((left, right) => {
      const scoreDelta = score(right) - score(left);
      if (scoreDelta !== 0) return scoreDelta;
      return (right.updated?.getTime?.() ?? 0) - (left.updated?.getTime?.() ?? 0);
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await Rule.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return !!result;
  }
}

export const ruleService = new RuleService();
