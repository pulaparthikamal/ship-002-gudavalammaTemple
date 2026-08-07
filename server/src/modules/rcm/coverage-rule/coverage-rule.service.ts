import { CoverageRule, ICoverageRule } from './coverage-rule.model';
import { normalizeUsState } from '../shared/state-normalization';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
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

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeCode(value))
    .filter((value): value is string => Boolean(value));
}

function normalizePayload(data: Partial<ICoverageRule>): Partial<ICoverageRule> {
  const normalizedData = { ...data };

  if (data.payerId !== undefined) normalizedData.payerId = normalizeText(data.payerId);
  if (data.planName !== undefined) normalizedData.planName = normalizeText(data.planName);
  if (data.groupNumber !== undefined) normalizedData.groupNumber = normalizeText(data.groupNumber);
  if (data.state !== undefined) normalizedData.state = normalizeUsState(data.state);
  if (data.cptCode !== undefined) normalizedData.cptCode = normalizeCode(data.cptCode);
  if (data.diagnosisCodes !== undefined) normalizedData.diagnosisCodes = normalizeStringArray(data.diagnosisCodes);
  if (data.placeOfServiceCode !== undefined) normalizedData.placeOfServiceCode = normalizeText(data.placeOfServiceCode);
  if (data.network !== undefined) normalizedData.network = normalizeText(data.network);
  if (data.coverageType !== undefined) normalizedData.coverageType = normalizeText(data.coverageType);
  if (data.ruleType !== undefined) normalizedData.ruleType = normalizeCode(data.ruleType) ?? data.ruleType;
  if (data.severity !== undefined) normalizedData.severity = normalizeCode(data.severity);

  return normalizedData;
}

function validateDateRange(data: Partial<ICoverageRule>) {
  const effectiveDate = normalizeDate(data.effectiveDate);
  const expiryDate = normalizeDate(data.expiryDate);

  if (effectiveDate && expiryDate && expiryDate.getTime() < effectiveDate.getTime()) {
    throw new AppError('Expiry date must be on or after the effective date.', HTTP_STATUS.BAD_REQUEST);
  }
}

export type CoverageRuleEvaluationInput = {
  payerId?: string;
  patientId?: string;
  insurancePolicyId?: string;
  providerId?: string;
  facilityId?: string;
  state?: string;
  cptCode?: string;
  diagnosisCodes?: string[];
  modifiers?: string[];
  posCode?: string;
  placeOfServiceCode?: string;
  serviceDate?: Date | string;
  planName?: string;
  groupNumber?: string;
  network?: string;
  coverageType?: string;
  eligibilityVerificationId?: string;
};

export type CoverageRuleEvaluationResult = {
  covered: boolean;
  authorizationRequired: boolean;
  referralRequired: boolean;
  warnings: string[];
  errors: string[];
  matchedRules: Array<{
    _id: string;
    coverageRuleId?: string;
    ruleType: string;
    ruleValue?: unknown;
    priority?: number;
    message: string;
  }>;
};

export class CoverageRuleService {
  async create(data: Partial<ICoverageRule>) {
    const normalizedData = normalizePayload(data);
    validateDateRange(normalizedData);
    return CoverageRule.create(normalizedData);
  }

  async getById(id: string) {
    return CoverageRule.findOne({ _id: id, isDeleted: false });
  }

  async update(id: string, data: Partial<ICoverageRule>) {
    const existing = await CoverageRule.findOne({ _id: id, isDeleted: false });
    if (!existing) {
      return null;
    }

    const normalizedData = normalizePayload(data);
    validateDateRange({
      ...existing.toObject(),
      ...normalizedData,
    });

    return CoverageRule.findOneAndUpdate(
      { _id: id, isDeleted: false },
      normalizedData,
      { new: true }
    );
  }

  async delete(id: string) {
    const result = await CoverageRule.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { active: false, isDeleted: true, deletedAt: new Date() }
    );
    return Boolean(result);
  }

  async list(criteria: any): Promise<{ data: ICoverageRule[]; total: number }> {
    const filter = { ...criteria.filter, isDeleted: false };
    const [data, total] = await Promise.all([
      CoverageRule.list({ ...criteria, filter }),
      CoverageRule.totalCount({ filter }),
    ]);
    return { data, total };
  }

  async findApplicable(input: CoverageRuleEvaluationInput): Promise<ICoverageRule[]> {
    const payerId = normalizeText(input.payerId);
    const providerId = normalizeText(input.providerId);
    const facilityId = normalizeText(input.facilityId);
    const state = normalizeUsState(input.state);
    const cptCode = normalizeCode(input.cptCode);
    const placeOfServiceCode = normalizeText(input.placeOfServiceCode ?? input.posCode);
    const planName = normalizeText(input.planName);
    const groupNumber = normalizeText(input.groupNumber);
    const network = normalizeText(input.network);
    const coverageType = normalizeText(input.coverageType);
    const serviceDate = normalizeDate(input.serviceDate) ?? new Date();

    return CoverageRule.find({
      active: true,
      activeFlag: { $ne: false },
      isDeleted: false,
      $and: [
        { $or: [{ effectiveDate: { $exists: false } }, { effectiveDate: null }, { effectiveDate: { $lte: serviceDate } }] },
        { $or: [{ expiryDate: { $exists: false } }, { expiryDate: null }, { expiryDate: { $gte: serviceDate } }] },
        { $or: [{ payerId: payerId ? payerId : { $exists: false } }, { payerId: { $exists: false } }, { payerId: null }, { payerId: '' }] },
        { $or: [{ providerId: providerId ? providerId : { $exists: false } }, { providerId: { $exists: false } }, { providerId: null }] },
        { $or: [{ facilityId: facilityId ? facilityId : { $exists: false } }, { facilityId: { $exists: false } }, { facilityId: null }] },
        { $or: [{ state: state ? state : { $exists: false } }, { state: { $exists: false } }, { state: null }, { state: '' }] },
        { $or: [{ cptCode: cptCode ? cptCode : { $exists: false } }, { cptCode: { $exists: false } }, { cptCode: null }, { cptCode: '' }] },
        { $or: [{ placeOfServiceCode: placeOfServiceCode ? placeOfServiceCode : { $exists: false } }, { placeOfServiceCode: { $exists: false } }, { placeOfServiceCode: null }, { placeOfServiceCode: '' }] },
        { $or: [{ planName: planName ? planName : { $exists: false } }, { planName: { $exists: false } }, { planName: null }, { planName: '' }] },
        { $or: [{ groupNumber: groupNumber ? groupNumber : { $exists: false } }, { groupNumber: { $exists: false } }, { groupNumber: null }, { groupNumber: '' }] },
        { $or: [{ network: network ? network : { $exists: false } }, { network: { $exists: false } }, { network: null }, { network: '' }] },
        { $or: [{ coverageType: coverageType ? coverageType : { $exists: false } }, { coverageType: { $exists: false } }, { coverageType: null }, { coverageType: '' }] },
      ],
    }).sort({ priority: -1, effectiveDate: -1, updated: -1 });
  }

  async evaluateCoverageRules(input: CoverageRuleEvaluationInput): Promise<CoverageRuleEvaluationResult> {
    const rules = await this.findApplicable(input);
    const diagnosisCodes = normalizeStringArray(input.diagnosisCodes);
    const modifiers = normalizeStringArray(input.modifiers);
    const network = normalizeText(input.network);
    const posCode = normalizeText(input.placeOfServiceCode ?? input.posCode);
    const result: CoverageRuleEvaluationResult = {
      covered: true,
      authorizationRequired: false,
      referralRequired: false,
      warnings: [],
      errors: [],
      matchedRules: [],
    };

    const addRule = (rule: ICoverageRule, message: string) => {
      result.matchedRules.push({
        _id: String(rule._id),
        coverageRuleId: rule.coverageRuleId ? String(rule.coverageRuleId) : undefined,
        ruleType: rule.ruleType,
        ruleValue: rule.ruleValue,
        priority: rule.priority,
        message,
      });
    };

    for (const rule of rules) {
      const ruleType = normalizeCode(rule.ruleType);
      const ruleDiagnosisCodes = normalizeStringArray(rule.diagnosisCodes);
      const ruleValue = rule.ruleValue;
      const ruleValueSeverity = typeof ruleValue === 'object' && ruleValue !== null
        ? normalizeCode((ruleValue as Record<string, unknown>).severity)
        : undefined;
      const severity = normalizeCode(rule.severity) ?? ruleValueSeverity ?? 'WARNING';

      if (ruleDiagnosisCodes.length && !ruleDiagnosisCodes.some((code) => diagnosisCodes.includes(code))) {
        continue;
      }

      switch (ruleType) {
        case 'AUTH_REQUIRED':
          result.authorizationRequired = true;
          addRule(rule, 'Prior authorization is required by coverage rule.');
          break;
        case 'REFERRAL_REQUIRED':
          result.referralRequired = true;
          addRule(rule, 'Referral is required by coverage rule.');
          break;
        case 'NOT_COVERED':
          result.covered = false;
          result.errors.push('Service is not covered by matched coverage rule.');
          addRule(rule, 'Service is not covered.');
          break;
        case 'COVERED':
          addRule(rule, 'Service is covered by matched coverage rule.');
          break;
        case 'MEDICAL_NECESSITY_REQUIRED':
          result.warnings.push('Medical necessity documentation is required.');
          addRule(rule, 'Medical necessity documentation is required.');
          break;
        case 'DIAGNOSIS_REQUIRED':
          if (!diagnosisCodes.length) {
            result.errors.push('Diagnosis code is required by coverage rule.');
          }
          addRule(rule, 'Diagnosis code requirement evaluated.');
          break;
        case 'MODIFIER_REQUIRED': {
          const requiredModifiers = normalizeStringArray(
            typeof ruleValue === 'object' && ruleValue !== null
              ? (ruleValue as Record<string, unknown>).modifiers
              : [ruleValue]
          );
          const missingModifiers = requiredModifiers.filter((modifier) => !modifiers.includes(modifier));
          if (missingModifiers.length) {
            result.errors.push(`Required modifier missing: ${missingModifiers.join(', ')}.`);
          }
          addRule(rule, 'Modifier requirement evaluated.');
          break;
        }
        case 'POS_RESTRICTED': {
          const allowedPosCodes = normalizeStringArray(
            typeof ruleValue === 'object' && ruleValue !== null
              ? (ruleValue as Record<string, unknown>).allowedPosCodes
              : [ruleValue]
          );
          if (allowedPosCodes.length && posCode && !allowedPosCodes.includes(posCode)) {
            result.errors.push(`Place of service ${posCode} is restricted by coverage rule.`);
          }
          addRule(rule, 'Place of service restriction evaluated.');
          break;
        }
        case 'NETWORK_RESTRICTED': {
          const allowedNetworks = normalizeStringArray(
            typeof ruleValue === 'object' && ruleValue !== null
              ? (ruleValue as Record<string, unknown>).allowedNetworks
              : [ruleValue]
          );
          if (allowedNetworks.length && network && !allowedNetworks.includes(network.toUpperCase())) {
            result.errors.push(`Network ${network} is restricted by coverage rule.`);
          }
          addRule(rule, 'Network restriction evaluated.');
          break;
        }
        case 'AGE_LIMIT':
        case 'GENDER_LIMIT':
        case 'FREQUENCY_LIMIT':
          if (severity === 'BLOCKING') {
            result.errors.push(`${ruleType.replace(/_/g, ' ')} rule matched and is configured as blocking.`);
          } else {
            result.warnings.push(`${ruleType.replace(/_/g, ' ')} rule matched and requires deterministic context validation.`);
          }
          addRule(rule, `${ruleType.replace(/_/g, ' ')} rule matched.`);
          break;
        default:
          result.warnings.push(`Coverage rule ${rule.ruleType} matched.`);
          addRule(rule, `Coverage rule ${rule.ruleType} matched.`);
      }
    }

    return result;
  }
}

export const coverageRuleService = new CoverageRuleService();
