import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import requestIp from 'request-ip';
import mongoose, { Types, FilterQuery, Model } from 'mongoose';
import _ from 'lodash';
import moment from 'moment-timezone';
import * as fs from 'fs';

import config from '../config/config';
import dateUtil from './date.util';
import sessionUtil from './session.util';
import { activityService } from '../modules/activity/activity.service';

const randomNumber = require('random-number');
const randomBase64String = require('random-base64-string');

// --- Interfaces ---

export interface GlobalSearch {
  type: string;
  value: string;
}

export interface FilterCriteria {
  key: string;
  value: any;
  type: 'eq' | 'in' | 'gte' | 'lte' | 'gt' | 'lt' | 'ne' | 'nin' | 'regexOr' | 'sw' | 'ew' | 'exists' | 'notexists' | 'dateis' | 'datenin' | 'datelt' | 'dategt' | 'dategte' | 'datelte' | 'dateIsNot' | 'dateeq';
}

export interface SortingItem {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ListQueryCred {
  limit?: number | string;
  page?: number | string;
  sortfield?: string;
  direction?: 'asc' | 'desc';
  globalSearch?: GlobalSearch;
  criteria?: FilterCriteria[];
  dashboardQueue?: string;
  dashboardEntityId?: string;
  secondorySorting?: SortingItem[];
  isDateSearch?: boolean;
}

export interface ListQueryCriteria {
  limit: number;
  page: number;
  sortfield: string;
  direction: 'asc' | 'desc';
  filter: FilterQuery<any>;
  sorting: Record<string, 1 | -1>;
  pagination: {
    limit: number;
    page: number;
    totalCount?: number;
  };
}

// --- Helper Functions ---

/**
 * generate UUID 5
 */
export const generateUUID5 = (): string => {
  return randomUUID();
};

/**
 * get client ip
 */
export const getClientIp = (req: Request): string | null => {
  return requestIp.getClientIp(req);
};

/**
 * get bearer token
 */
export const getBearerToken = (headers: any): string | null => {
  if (headers && headers.authorization) {
    const parted = headers.authorization.split(' ');
    if (parted.length === 2) return parted[1];
  }
  return null;
};

/**
 * Check Permissions for View or Edit
 */
export const checkPermission = async (req: Request, res: Response, type: string, controller: string): Promise<boolean | void> => {
  if (!(req as any).user || !(req as any).user.role) return;

  const role = (req as any).user.role;
  
  // SUPER_ADMIN bypass
  if (role.role === 'SUPER_ADMIN') return true;

  const permissions = role.permissions;
  if (!permissions) return;

  // Try exact match first
  let modulePermissions = typeof permissions.get === 'function'
    ? permissions.get(controller)
    : (permissions as any)[controller];

  // If not found, try case-insensitive match
  if (!modulePermissions) {
    const keys = typeof permissions.keys === 'function' ? Array.from(permissions.keys()) : Object.keys(permissions);
    const matchedKey = keys.find(k => (k as string).toLowerCase() === controller.toLowerCase());
    if (matchedKey) {
      modulePermissions = typeof permissions.get === 'function'
        ? permissions.get(matchedKey as string)
        : (permissions as any)[matchedKey as string];
    }
  }

  if (!modulePermissions) return;

  // Map requested type to common actions if needed, or use directly
  let requiredAction = type;
  if (type === "Edit") {
    // If 'Edit' is requested, check for Update or Add
    if (modulePermissions.actions.includes("Update") || modulePermissions.actions.includes("Add")) return true;
  }

  if (modulePermissions.actions.includes(requiredAction)) return true;

  req.i18nKey = "noPermissionErr";
  return;
};

/**
 * generate uuid
 */
export const generateUUID = (): string => {
  let d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

/**
 * generate random string
 */
export const generateRandomString = (length: number, chars: string): string => {
  let mask = '';
  if (chars.includes('a')) mask += 'abcdefghijklmnopqrstuvwxyz';
  if (chars.includes('A')) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (chars.includes('#')) mask += '0123456789';
  if (chars.includes('!')) mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
  
  let result = '';
  for (let i = length; i > 0; --i) result += mask[Math.floor(Math.random() * mask.length)];
  return result;
};

/**
 * Modular logic for Global Search
 */
const buildGlobalSearch = (screenName: string, globalSearch: GlobalSearch, filter: any) => {
  if (!globalSearch.value) return;

  const searchValue = String(globalSearch.value).trim();
  if (!searchValue) return;

  const allFields = ["email", "phone", "displayName", "address", "name", "gender", "employeeName", "role", "status", "createdByName"];
  const rcmCommonStringFields = [
    'claimStatus',
    'submissionStatus',
    'chargeStatus',
    'codingReviewStatus',
    'denialStatus',
    'appealStatus',
    'status',
    'severity',
    'priority',
    'notes',
    'description',
    'reason',
    'owner',
    'source',
    'type',
    'category',
    'payerId',
    'ediPayerId',
    'payerName',
    'patientName',
    'providerName',
    'facilityName',
    'claimControlNumber',
    'controlNumber',
    'submissionTraceId',
    'externalSubmissionId',
    'trackingNumber',
    'referenceNumber',
    'confirmationNumber',
    'cptCode',
    'denialCode',
    'procedureCode',
    'diagnosisCode',
  ];
  const rcmCommonDateFields = ['created', 'updated', 'createdAt', 'updatedAt'];
  const screenMappings: Record<string, any> = {
    "user": { stringFields: ["firstName", "lastName", "email", "phone"], numberFields: [], dateFields: ["createdAt", "updatedAt"] },
    "users": { stringFields: ["firstName", "lastName", "email", "phone"], numberFields: [], dateFields: ["createdAt", "updatedAt"] },
    "employee": { stringFields: ["firstName", "lastName", "email", "phone"], numberFields: [], dateFields: [] },
    "project": { stringFields: ["name"], numberFields: [], dateFields: [] },
    "patient": { stringFields: ["firstName", "lastName", "email", "patientId", "patientID", "phone", "gender"], numberFields: [], dateFields: [...rcmCommonDateFields, "dateOfBirth"], objectIdFields: [] },
    "provider": { stringFields: ["firstName", "lastName", "email", "providerId", "providerID", "npi", "specialty", "phone"], numberFields: [], dateFields: rcmCommonDateFields, objectIdFields: [] },
    "facility": { stringFields: ["facilityName", "name", "email", "facilityId", "facilityID", "npi", "phone", "placeOfServiceCode", "state"], numberFields: [], dateFields: rcmCommonDateFields, objectIdFields: [] },
    "payer": { stringFields: ["payerName", "name", "payerId", "payerID", "ediPayerId", "phone"], numberFields: ["timelyFilingDays", "appealTimelyFilingDays"], dateFields: rcmCommonDateFields, objectIdFields: [] },
    "appointment": { stringFields: ["appointmentStatus", "checkInStatus", "reason", "appointmentType", "visitType", "notes"], numberFields: [], dateFields: [...rcmCommonDateFields, "appointmentDate", "appointmentStart", "checkInTime", "checkOutTime"], objectIdFields: ["patientId", "providerId", "facilityId"] },
    "encounter": { stringFields: ["visitStatus", "chiefComplaint", "historyOfPresentIllness", "clinicalNotes"], numberFields: [], dateFields: [...rcmCommonDateFields, "encounterDate", "startTime", "endTime"], objectIdFields: ["appointmentId", "patientId", "providerId", "facilityId"] },
    "chargeMaster": { stringFields: ["cptCode", "description", "revenueCode", "placeOfService"], numberFields: ["defaultChargeAmount", "defaultAllowedAmount"], dateFields: [...rcmCommonDateFields, "effectiveDate", "terminationDate"], objectIdFields: [] },
    "charge": { stringFields: ["chargeStatus", "codingReviewStatus", "placeOfService", "validationErrors"], numberFields: ["totalChargeAmount"], dateFields: [...rcmCommonDateFields, "serviceDate"], objectIdFields: ["encounterId", "patientId", "providerId", "facilityId"] },
    "codingReview": { stringFields: ["scrubStatus", "codingRiskLevel", "validationErrors", "aiSuggestedFixes"], numberFields: [], dateFields: rcmCommonDateFields, objectIdFields: ["chargeId", "encounterId", "patientId", "providerId"] },
    "claim": { stringFields: ["claimStatus", "submissionStatus", "claimType", "payerId", "claimFrequencyCode"], numberFields: ["totalChargeAmount", "expectedAllowedAmount", "expectedInsurancePayment", "patientResponsibility"], dateFields: [...rcmCommonDateFields, "claimDate", "serviceDateFrom", "serviceDateTo"], objectIdFields: ["patientId", "providerId", "facilityId", "chargeId"] },
    "claimSubmission": { stringFields: ["submissionType", "submissionMethod", "clearinghouseName", "status", "normalizedStatus", "controlNumber", "claimControlNumber", "submissionTraceId", "externalSubmissionId", "lastError"], numberFields: ["retryCount", "responseStatusCode"], dateFields: [...rcmCommonDateFields, "submissionDateTime", "submittedAt", "acknowledgementDateTime"], objectIdFields: ["claimId"] },
    "claimTracking": { stringFields: ["trackingStatus", "status", "trackingSource", "payerStatus", "claimControlNumber", "externalClaimId", "message"], numberFields: [], dateFields: [...rcmCommonDateFields, "statusDate", "receivedAt"], objectIdFields: ["claimId", "submissionId"] },
    "paymentPosting": { stringFields: ["paymentMethod", "paymentReference", "payerName", "postingStatus", "eraTraceNumber"], numberFields: ["paymentAmount", "allowedAmount", "adjustmentAmount"], dateFields: [...rcmCommonDateFields, "paymentDate", "postedAt"], objectIdFields: ["claimId", "payerId"] },
    "eraEobProcessing": { stringFields: ["processingStatus", "paymentMethod", "traceNumber", "payerName", "status", "denialReason"], numberFields: ["paymentAmount", "allowedAmount", "patientResponsibility"], dateFields: [...rcmCommonDateFields, "paymentDate", "processedAt"], objectIdFields: ["claimId", "payerId"] },
    "denial": { stringFields: ["denialStatus", "denialCode", "denialReason", "reasonCode", "description", "owner", "resolution"], numberFields: ["deniedAmount"], dateFields: [...rcmCommonDateFields, "denialDate", "followUpDate"], objectIdFields: ["claimId", "paymentPostingId", "eraId"] },
    "appeal": { stringFields: ["appealStatus", "appealCategory", "appealLevel", "appealReason", "owner", "payerResponse", "resolution", "outcome"], numberFields: ["recoveredAmount", "daysRemaining"], dateFields: [...rcmCommonDateFields, "dueDate", "appealDeadline", "submittedAt", "payerReceivedAt", "decisionAt"], objectIdFields: ["claimId", "denialId", "arWorkItemId", "payerId"] },
    "arWorkItem": { stringFields: ["status", "workItemType", "priority", "owner", "notes", "nextAction"], numberFields: ["balanceAmount", "ageInDays"], dateFields: [...rcmCommonDateFields, "followUpDate", "dueDate"], objectIdFields: ["claimId", "denialId", "appealId", "patientId"] },
    "patientBilling": { stringFields: ["billingStatus", "statementStatus", "collectionStatus", "statementNumber", "notes"], numberFields: ["balanceAmount", "patientResponsibility", "amountPaid"], dateFields: [...rcmCommonDateFields, "statementDate", "dueDate"], objectIdFields: ["claimId", "patientId"] },
    "patientPayment": { stringFields: ["paymentMethod", "paymentReference", "paymentStatus", "notes"], numberFields: ["amount"], dateFields: [...rcmCommonDateFields, "paymentDate"], objectIdFields: ["patientId", "billingId", "claimId"] },
    "refund": { stringFields: ["refundStatus", "refundReason", "paymentMethod", "referenceNumber", "notes"], numberFields: ["refundAmount"], dateFields: [...rcmCommonDateFields, "refundDate"], objectIdFields: ["patientId", "claimId", "paymentId"] },
    "collection": { stringFields: ["collectionStatus", "collectionStage", "agencyName", "notes"], numberFields: ["balanceAmount"], dateFields: [...rcmCommonDateFields, "referredAt", "followUpDate"], objectIdFields: ["patientId", "claimId", "billingId"] },
    "task": { stringFields: ["taskId", "taskID", "title", "description", "status", "priority", "assignedTo", "notes"], numberFields: [], dateFields: [...rcmCommonDateFields, "dueDate"], objectIdFields: ["claimId", "patientId"] },
    "adjustment": { stringFields: ["adjustmentType", "adjustmentReason", "status", "notes"], numberFields: ["amount"], dateFields: [...rcmCommonDateFields, "adjustmentDate"], objectIdFields: ["claimId", "patientId"] },
    "correctedClaim": { stringFields: ["correctionStatus", "correctionReason", "notes"], numberFields: [], dateFields: [...rcmCommonDateFields, "submittedAt"], objectIdFields: ["claimId", "denialId"] },
    "priorAuthorization": { stringFields: ["authorizationNumber", "authorizationStatus", "status", "notes"], numberFields: [], dateFields: [...rcmCommonDateFields, "requestedDate", "approvedDate", "expirationDate"], objectIdFields: ["patientId", "payerId", "providerId"] },
    "referral": { stringFields: ["referralNumber", "referralStatus", "status", "reason", "notes"], numberFields: [], dateFields: [...rcmCommonDateFields, "referralDate", "expirationDate"], objectIdFields: ["patientId", "providerId"] },
    "insurancePolicy": { stringFields: ["policyNumber", "groupNumber", "coverageStatus", "payerName", "relationshipToSubscriber"], numberFields: [], dateFields: [...rcmCommonDateFields, "effectiveDate", "terminationDate"], objectIdFields: ["patientId", "payerId"] },
    "eligibilityVerification": { stringFields: ["status", "eligibilityStatus", "payerName", "memberId", "traceId"], numberFields: [], dateFields: [...rcmCommonDateFields, "verifiedAt", "serviceDate"], objectIdFields: ["patientId", "payerId"] },
    "claimAiReview": { stringFields: ["reviewStatus", "riskLevel", "summary", "recommendation"], numberFields: ["score"], dateFields: rcmCommonDateFields, objectIdFields: ["claimId"] },
    "claimPrediction": { stringFields: ["predictionStatus", "riskLevel", "recommendation", "reasoning"], numberFields: ["score", "confidence"], dateFields: rcmCommonDateFields, objectIdFields: ["claimId", "patientId"] },
    "document": { stringFields: ["documentName", "documentType", "documentCategory", "fileName", "status"], numberFields: ["fileSize"], dateFields: rcmCommonDateFields, objectIdFields: ["patientId", "claimId"] },
    "timelyFilingAlert": { stringFields: ["payerId", "severity", "status", "zapierDeliveryStatus"], numberFields: ["daysRemaining"], dateFields: [...rcmCommonDateFields, "serviceDate", "filingDeadline", "lastZapierTriggeredAt"], objectIdFields: ["claimId"] },
    "documentationComplianceAlert": { stringFields: ["severity", "status", "missingDocuments", "requiredDocuments", "matchedDocuments"], numberFields: [], dateFields: rcmCommonDateFields, objectIdFields: ["claimId"] },
    "eraException": { stringFields: ["exceptionType", "exceptionStatus", "status", "reason", "notes"], numberFields: ["amount"], dateFields: rcmCommonDateFields, objectIdFields: ["claimId", "eraId"] },
  };

  const mapping = screenMappings[screenName] || { stringFields: allFields, numberFields: [], dateFields: [] };
  const fields = {
    ...mapping,
    stringFields: Array.from(new Set([...(mapping.stringFields ?? []), ...rcmCommonStringFields])),
    dateFields: Array.from(new Set([...(mapping.dateFields ?? []), ...rcmCommonDateFields])),
    numberFields: mapping.numberFields ?? [],
    objectIdFields: mapping.objectIdFields ?? [],
  };
  
  if (!filter['$or']) filter['$or'] = [];

  fields.stringFields.forEach((f: string) => {
    filter['$or'].push({ [f]: { '$regex': searchValue, '$options': 'i' } });
  });

  fields.numberFields.forEach((f: string) => {
    const val = parseFloat(searchValue);
    if (!isNaN(val)) filter['$or'].push({ [f]: val });
  });

  if (Types.ObjectId.isValid(searchValue)) {
    fields.objectIdFields.forEach((f: string) => {
      filter['$or'].push({ [f]: new Types.ObjectId(searchValue) });
    });
  }

  fields.dateFields?.forEach((f: string) => {
    const parsed = moment(searchValue, ["DD-MM-YYYY", "YYYY-MM-DD", "MM-DD-YYYY"], true);
    if (parsed.isValid()) {
      filter['$or'].push({ [f]: { $gte: parsed.startOf('day').toDate(), $lte: parsed.endOf('day').toDate() } });
    }
  });

  if (!filter['$or'].length) {
    delete filter['$or'];
  }
};

/**
 * Modular logic for Filter Criteria
 */
const buildFilterCriteria = (criteria: FilterCriteria[], filter: any, isDateSearch?: boolean) => {
  criteria.forEach((v) => {
    let parsedDate: Date | null = null;
    if (v.type.toLowerCase().includes('date') && v.value) {
      const dateVal = Array.isArray(v.value) ? v.value[0] : v.value;
      if (dateVal) {
        parsedDate = moment(dateVal).toDate();
      }
    }

    const applyCondition = (condition: any, isNegative = false) => {
      const targetFields = v.key.includes('|') ? v.key.split('|') : [v.key];
      if (targetFields.length > 1) {
        const groupOp = isNegative ? '$and' : '$or';
        if (!filter['$and']) filter['$and'] = [];
        filter['$and'].push({ [groupOp]: targetFields.map(f => ({ [f]: condition })) });
      } else {
        if (typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof Date) && filter[v.key] && typeof filter[v.key] === 'object' && !Array.isArray(filter[v.key]) && !(filter[v.key] instanceof Date)) {
          filter[v.key] = { ...filter[v.key], ...condition };
        } else {
          filter[v.key] = condition;
        }
      }
    };

    switch (v.type as any) {
      case 'eq':
      case 'equals':
        if (v.value instanceof Date) applyCondition(v.value);
        else if (Types.ObjectId.isValid(v.value)) applyCondition(new Types.ObjectId(v.value));
        else if (typeof v.value === "string" && v.value !== '') applyCondition({ $regex: `^${v.value}$`, $options: 'i' });
        else applyCondition(v.value);
        break;
      case 'ne':
      case 'notEquals':
        if (Types.ObjectId.isValid(v.value)) applyCondition({ $ne: new Types.ObjectId(v.value) }, true);
        else applyCondition({ $ne: v.value }, true);
        break;
      case 'contains':
        applyCondition({ '$regex': v.value, '$options': 'i' });
        break;
      case 'notContains':
        applyCondition({ '$not': { '$regex': v.value, '$options': 'i' } }, true);
        break;
      case 'sw':
      case 'startsWith':
      case 'sw' as any:
        applyCondition({ '$regex': `^${v.value}`, '$options': 'i' });
        break;
      case 'ew':
      case 'endsWith':
      case 'ew' as any:
        applyCondition({ '$regex': `${v.value}$`, '$options': 'i' });
        break;
      case 'contains':
      case 'regexOr' as any:
        applyCondition({ '$regex': v.value, '$options': 'i' });
        break;
      case 'in':
        if (Array.isArray(v.value)) applyCondition({ "$in": v.value });
        break;
      case 'nin':
      case 'notIn':
      case 'nin' as any:
      case 'notIn' as any:
        if (Array.isArray(v.value)) applyCondition({ "$nin": v.value }, true);
        break;
      case 'gte':
        applyCondition({ "$gte": v.value });
        break;
      case 'lte':
        applyCondition({ "$lte": v.value });
        break;
      case 'gt':
        applyCondition({ "$gt": v.value });
        break;
      case 'lt':
        applyCondition({ "$lt": v.value });
        break;
      case 'regexOr':
        applyCondition({ '$regex': v.value, '$options': 'i' });
        break;
      case 'dateis':
        if (parsedDate) {
          applyCondition({ 
            $gte: moment(parsedDate).startOf('day').toDate(), 
            $lte: moment(parsedDate).endOf('day').toDate() 
          });
        }
        break;
      case 'dateIsNot':
        if (parsedDate) {
          applyCondition({
            $not: {
              $gte: moment(parsedDate).startOf('day').toDate(), 
              $lte: moment(parsedDate).endOf('day').toDate()
            }
          }, true);
        }
        break;
      case 'datelt':
        if (parsedDate) {
          applyCondition({ $lt: moment(parsedDate).startOf('day').toDate() });
        }
        break;
      case 'dategt':
        if (parsedDate) {
          applyCondition({ $gt: moment(parsedDate).endOf('day').toDate() });
        }
        break;
      case 'dategte':
        if (parsedDate) {
          applyCondition({ $gte: moment(parsedDate).startOf('day').toDate() });
        }
        break;
      case 'datelte':
        if (parsedDate) {
          applyCondition({ $lte: moment(parsedDate).endOf('day').toDate() });
        }
        break;
      // Add more cases as needed for enterprise expansion
    }
  });
};

const exactRegex = (value: string) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const exactRegexIn = (values: string[]) => values.map(exactRegex);
const containsRegex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const containsRegexIn = (values: string[]) => values.map(containsRegex);
const statusRegex = (value: string) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[_\s-]+/g, '[_\\s-]+')}$`, 'i');
const statusRegexIn = (values: string[]) => values.map(statusRegex);

const appendAndCondition = (filter: any, condition: any) => {
  if (!filter.$and) filter.$and = [];
  filter.$and.push(condition);
};

const appendDashboardQueueFilter = (screenName: string, queue: string | undefined, filter: any) => {
  if (!queue) return;
  let handled = true;

  const now = new Date();
  const eligibilityValidDays = Number.parseInt(process.env.RCM_ELIGIBILITY_VALID_DAYS ?? '7', 10);
  const eligibilityFreshnessDays = Number.isFinite(eligibilityValidDays) && eligibilityValidDays > 0
    ? eligibilityValidDays
    : 7;
  const staleVerificationCutoff = new Date(now.getTime() - eligibilityFreshnessDays * 24 * 60 * 60 * 1000);
  const patientAccessStaleCutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const followUpCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const openArStatusFilter = {
    status: { $nin: statusRegexIn(['RESOLVED', 'CLOSED']) },
  };
  const openPatientBillingFilter = {
    $and: [
      {
        $or: [
          { currentBalance: { $gt: 0 } },
          { amountDue: { $gt: 0 } },
          { patientBalance: { $gt: 0 } },
        ],
      },
      {
        $or: [
          { status: { $exists: false } },
          { status: { $nin: statusRegexIn(['PAID', 'VOID']) } },
        ],
      },
      {
        $or: [
          { statementStatus: { $exists: false } },
          { statementStatus: { $nin: statusRegexIn(['PAID', 'VOID']) } },
        ],
      },
    ],
  };
  const openCollectionFilter = {
    $and: [
      { status: { $nin: statusRegexIn(['CLOSED', 'SETTLED', 'WRITTEN_OFF']) } },
      { collectionStatus: { $nin: statusRegexIn(['CLOSED', 'SETTLED', 'WRITTEN_OFF']) } },
    ],
  };
  const openDenialFilter = {
    denialStatus: { $nin: statusRegexIn(['RESOLVED', 'WRITTEN_OFF']) },
  };
  const missingLinePricingFilter = {
    claimLines: {
      $elemMatch: {
        $or: [
          { feeScheduleId: { $exists: false } },
          { feeScheduleId: null },
          { expectedAllowedAmount: { $exists: false } },
          { expectedAllowedAmount: null },
        ],
      },
    },
  };
  const missingLineEligibilityFilter = {
    claimLines: {
      $elemMatch: {
        $or: [
          { eligibilityVerificationId: { $exists: false } },
          { eligibilityVerificationId: null },
          { 'coverageRuleSnapshot.eligibility.planActive': false },
          {
            $and: [
              { 'coverageRuleSnapshot.eligibility.coverageStatus': { $exists: true } },
              { 'coverageRuleSnapshot.eligibility.coverageStatus': { $nin: containsRegexIn(['active', 'eligible', 'covered', 'completed']) } },
            ],
          },
          {
            $and: [
              { 'coverageRuleSnapshot.eligibility.eligibilityStatus': { $exists: true } },
              { 'coverageRuleSnapshot.eligibility.eligibilityStatus': { $nin: containsRegexIn(['active', 'eligible', 'covered', 'completed', 'verified']) } },
            ],
          },
          { 'coverageRuleSnapshot.eligibility.checkedAt': { $lt: staleVerificationCutoff } },
        ],
      },
    },
  };
  const coverageRuleFailureFilter = {
    claimLines: {
      $elemMatch: {
        $or: [
          { 'coverageRuleSnapshot.coverageRules.covered': false },
          { 'coverageRuleSnapshot.coverageRules.errors.0': { $exists: true } },
        ],
      },
    },
  };
  const missingAuthorizationFilter = {
    claimLines: {
      $elemMatch: {
        authorizationRequired: true,
        $or: [
          { priorAuthorizationId: { $exists: false } },
          { priorAuthorizationId: null },
        ],
      },
    },
  };
  const missingReferralFilter = {
    claimLines: {
      $elemMatch: {
        referralRequired: true,
        $or: [
          { referralId: { $exists: false } },
          { referralId: null },
        ],
      },
    },
  };
  const missingClaimHeaderFilter = {
    $or: [
      { frequencyCode: { $exists: false } },
      { frequencyCode: { $in: [null, ''] } },
      { 'diagnosisCodes.0': { $exists: false } },
      { claimLines: { $size: 0 } },
    ],
  };
  const claimBlockerFilter = {
    $or: [
      missingClaimHeaderFilter,
      missingLinePricingFilter,
      missingLineEligibilityFilter,
      coverageRuleFailureFilter,
      missingAuthorizationFilter,
      missingReferralFilter,
      { submissionStatus: { $exists: true, $nin: exactRegexIn(['not submitted']) } },
    ],
  };
  const claimSubmissionStatusFilter = (values: string[]) => ({
    $or: [
      { status: { $in: statusRegexIn(values) } },
      { normalizedStatus: { $in: statusRegexIn(values) } },
      { transmissionStatus: { $in: statusRegexIn(values) } },
      { acknowledgementStatus: { $in: statusRegexIn(values) } },
    ],
  });
  const claimTrackingRejectedFilter = {
    $or: [
      { normalizedStatus: { $in: statusRegexIn(['REJECTED']) } },
      { rawStatusCode: { $in: statusRegexIn(['REJECTED', 'A3', 'A6', 'A7', 'A8']) } },
      { statusCode: { $in: statusRegexIn(['REJECTED', 'A3', 'A6', 'A7', 'A8']) } },
      { statusDescription: { $regex: 'reject|denied|invalid|not accepted', $options: 'i' } },
      { eventType: { $in: statusRegexIn(['ACK_999_REJECTED', 'ACK_277CA_REJECTED']) } },
      { rejectionLevel: { $exists: true, $ne: '' } },
      { rejectionSource: { $exists: true, $ne: '' } },
      { 'rejectionReasonCodes.0': { $exists: true } },
    ],
  };

  switch (`${screenName}:${queue}`) {
    case 'insurancePolicy:patient-access':
      appendAndCondition(filter, {
        $or: [
          { 'verification.nextVerificationDueDate': { $lte: now } },
          { 'verification.lastVerifiedDateTime': { $lt: patientAccessStaleCutoff } },
          { terminationDate: { $lte: now } },
          { policyStatus: { $in: exactRegexIn(['inactive', 'terminated', 'cancelled', 'hold', 'error']) } },
        ],
      });
      break;
    case 'priorAuthorization:authorization':
      appendAndCondition(filter, {
        $or: [
          { authorizationRequired: true, authNumber: { $in: [null, ''] } },
          { authorizationStatus: { $in: exactRegexIn(['pending', 'requested', 'submitted', 'in review', 'denied', 'escalated']) } },
          { denialReason: { $exists: true, $ne: '' } },
          { expirationDate: { $lte: now } },
        ],
      });
      break;
    case 'charge:coding':
      appendAndCondition(filter, {
        $or: [
          { documentationComplete: false },
          { 'validationErrors.0': { $exists: true } },
          { codingReviewStatus: { $in: exactRegexIn(['pending', 'needs review', 'rejected', 'returned']) } },
          { chargeStatus: { $in: exactRegexIn(['open', 'captured', 'queued']) } },
        ],
      });
      break;
    case 'codingReview:coding-review':
      appendAndCondition(filter, {
        $or: [
          { scrubStatus: { $in: exactRegexIn(['pending', 'failed', 'needs review', 'error']) } },
          { codingRiskLevel: { $in: exactRegexIn(['high', 'medium']) } },
          { 'validationErrors.0': { $exists: true } },
          { 'modifierIssues.0': { $exists: true } },
          { 'payerSpecificRuleFailures.0': { $exists: true } },
        ],
      });
      break;
    case 'claim:claims':
      break;
    case 'claim:claims-ready':
      appendAndCondition(filter, {
        submissionStatus: { $in: exactRegexIn(['not submitted']) },
        frequencyCode: { $exists: true, $nin: [null, ''] },
        'diagnosisCodes.0': { $exists: true },
        'claimLines.0': { $exists: true },
        claimLines: {
          $not: {
            $elemMatch: {
              $or: [
                { feeScheduleId: { $exists: false } },
                { feeScheduleId: null },
                { expectedAllowedAmount: { $exists: false } },
                { expectedAllowedAmount: null },
                { eligibilityVerificationId: { $exists: false } },
                { eligibilityVerificationId: null },
                { 'coverageRuleSnapshot.eligibility.planActive': false },
                { 'coverageRuleSnapshot.eligibility.coverageStatus': { $nin: exactRegexIn(['active', 'eligible']) } },
                { 'coverageRuleSnapshot.coverageRules.covered': false },
                { 'coverageRuleSnapshot.coverageRules.errors.0': { $exists: true } },
                { authorizationRequired: true, priorAuthorizationId: { $exists: false } },
                { authorizationRequired: true, priorAuthorizationId: null },
                { referralRequired: true, referralId: { $exists: false } },
                { referralRequired: true, referralId: null },
              ],
            },
          },
        },
      });
      break;
    case 'claim:claims-blocked':
      appendAndCondition(filter, claimBlockerFilter);
      break;
    case 'claim:missing-contract-rates':
      appendAndCondition(filter, missingLinePricingFilter);
      break;
    case 'claim:eligibility-failures':
      appendAndCondition(filter, missingLineEligibilityFilter);
      break;
    case 'claim:coverage-rule-failures':
      appendAndCondition(filter, coverageRuleFailureFilter);
      break;
    case 'claim:auth-missing':
      appendAndCondition(filter, missingAuthorizationFilter);
      break;
    case 'claim:referral-missing':
      appendAndCondition(filter, missingReferralFilter);
      break;
    case 'claim:underpaid-claims':
      appendAndCondition(filter, {
        paymentStatus: { $in: statusRegexIn(['UNDERPAID']) },
      });
      break;
    case 'claimSubmission:claim-submission':
      appendAndCondition(filter, {
        $or: [
          { normalizedStatus: { $in: statusRegexIn(['FAILED', 'REJECTED']) } },
          { transmissionStatus: { $in: statusRegexIn(['FAILED', 'REJECTED', 'ERROR', 'NEEDS_CORRECTION', 'NOT_SUBMITTED', 'TRANSPORT_FAILED']) } },
          { acknowledgementStatus: { $in: statusRegexIn(['FAILED', 'REJECTED', 'ERROR', 'NEEDS_CORRECTION', 'NOT_SUBMITTED', 'TRANSPORT_FAILED']) } },
          { submissionErrorCode: { $exists: true, $ne: '' } },
          { submissionErrorMessage: { $exists: true, $ne: '' } },
        ],
      });
      break;
    case 'claimSubmission:claim-submitted':
      appendAndCondition(filter, claimSubmissionStatusFilter(['SUBMITTED', 'TRANSMITTED', 'SENT', 'QUEUED', 'PRINTED']));
      break;
    case 'claimSubmission:claim-accepted':
      appendAndCondition(filter, claimSubmissionStatusFilter(['ACCEPTED', 'ACKNOWLEDGED', 'APPROVED', 'A1', 'A2']));
      break;
    case 'claimSubmission:claim-rejected':
      appendAndCondition(filter, {
        $or: [
          { status: { $in: statusRegexIn(['REJECTED', 'DENIED', 'INVALID', 'NOT_ACCEPTED', 'A3', 'A6', 'A7', 'A8']) } },
          { normalizedStatus: { $in: statusRegexIn(['REJECTED']) } },
          { transmissionStatus: { $in: statusRegexIn(['REJECTED', 'DENIED', 'INVALID', 'NOT_ACCEPTED', 'A3', 'A6', 'A7', 'A8']) } },
          { acknowledgementStatus: { $in: statusRegexIn(['REJECTED', 'DENIED', 'INVALID', 'NOT_ACCEPTED', 'A3', 'A6', 'A7', 'A8']) } },
          { submissionErrorCode: { $exists: true, $ne: '' } },
          { submissionErrorMessage: { $exists: true, $ne: '' } },
          { lastError: { $exists: true, $ne: '' } },
        ],
      });
      break;
    case 'claimSubmission:claim-pending':
      appendAndCondition(filter, {
        $or: [
          { status: { $in: statusRegexIn(['PENDING', 'QUEUED', 'PROCESSING', 'IN_PROGRESS']) } },
          { normalizedStatus: { $in: statusRegexIn(['PENDING']) } },
          { transmissionStatus: { $in: statusRegexIn(['PENDING', 'QUEUED', 'PROCESSING', 'IN_PROGRESS']) } },
          { acknowledgementStatus: { $regex: 'pending|queued|processing|in progress', $options: 'i' } },
        ],
      });
      break;
    case 'claimSubmission:claim-failed':
      appendAndCondition(filter, {
        $or: [
          { status: { $in: statusRegexIn(['FAILED', 'ERROR', 'TRANSPORT_FAILED', 'NOT_CONFIGURED', 'TIMEOUT']) } },
          { normalizedStatus: { $in: statusRegexIn(['FAILED']) } },
          { transmissionStatus: { $in: statusRegexIn(['FAILED', 'ERROR', 'TRANSPORT_FAILED', 'NOT_CONFIGURED', 'TIMEOUT']) } },
          { acknowledgementStatus: { $in: statusRegexIn(['FAILED', 'ERROR', 'TRANSPORT_FAILED', 'NOT_CONFIGURED', 'TIMEOUT']) } },
          { submissionErrorCode: { $exists: true, $ne: '' } },
          { submissionErrorMessage: { $exists: true, $ne: '' } },
          { lastError: { $exists: true, $ne: '' } },
        ],
      });
      break;
    case 'claimTracking:claim-tracking':
    case 'claimTracking:claim-follow-up':
      appendAndCondition(filter, {
        $or: [
          ...claimTrackingRejectedFilter.$or,
          { normalizedStatus: { $in: statusRegexIn(['REJECTED', 'FAILED']) } },
          { rawStatusCode: { $in: statusRegexIn(['FAILED']) } },
          { statusCode: { $in: statusRegexIn(['FAILED']) } },
          { nextActionRequired: { $exists: true, $ne: '' } },
        ],
      });
      break;
    case 'claimTracking:claim-rejections':
      appendAndCondition(filter, claimTrackingRejectedFilter);
      break;
    case 'eraEobProcessing:era-received':
      break;
    case 'eraEobProcessing:unmatched-eras':
      appendAndCondition(filter, {
        $or: [
          { importStatus: { $in: statusRegexIn(['UNMATCHED', 'PARTIALLY_MATCHED']) } },
          { 'unmatchedClaims.0': { $exists: true } },
        ],
      });
      break;
    case 'paymentPosting:payments-posted':
      appendAndCondition(filter, {
        postingStatus: { $in: statusRegexIn(['POSTED', 'PARTIAL']) },
      });
      break;
    case 'adjustment:era-adjustments':
      appendAndCondition(filter, {
        $or: [
          { source: { $in: statusRegexIn(['835_ERA']) } },
          { eraEobProcessingId: { $exists: true, $ne: null } },
          { paymentPostingId: { $exists: true, $ne: null } },
        ],
      });
      break;
    case 'denial:denials':
    case 'denial:open-denials':
      appendAndCondition(filter, openDenialFilter);
      break;
    case 'denial:denial-amount':
      appendAndCondition(filter, {
        ...openDenialFilter,
        denialAmount: { $gt: 0 },
      });
      break;
    case 'denial:preventable-denials':
      appendAndCondition(filter, {
        ...openDenialFilter,
        preventableFlag: true,
      });
      break;
    case 'denial:appeal-ready':
      appendAndCondition(filter, {
        ...openDenialFilter,
        denialStatus: { $in: statusRegexIn(['APPEAL_READY']) },
      });
      break;
    case 'denial:corrected-claim-ready':
      appendAndCondition(filter, {
        ...openDenialFilter,
        denialStatus: { $in: statusRegexIn(['CORRECTED_CLAIM_READY']) },
      });
      break;
    case 'denial:denial-recovery-rate':
      appendAndCondition(filter, {
        denialStatus: { $in: statusRegexIn(['RESOLVED']) },
      });
      break;
    case 'denial:preventable-denial-recovery':
      appendAndCondition(filter, {
        preventableFlag: true,
        denialStatus: { $in: statusRegexIn(['RESOLVED']) },
      });
      break;
    case 'appeal:appeals':
    case 'appeal:appeals-pending':
      appendAndCondition(filter, {
        appealStatus: { $in: statusRegexIn(['OPEN', 'DRAFT', 'READY', 'PENDING', 'SUBMITTED', 'IN_REVIEW', 'ESCALATED']) },
      });
      break;
    case 'appeal:appeals-overturned':
      appendAndCondition(filter, {
        $or: [
          { appealStatus: { $in: statusRegexIn(['OVERTURNED']) } },
          { outcome: { $in: statusRegexIn(['OVERTURNED']) } },
        ],
      });
      break;
    case 'appeal:appeals-upheld':
      appendAndCondition(filter, {
        $or: [
          { appealStatus: { $in: statusRegexIn(['UPHELD']) } },
          { outcome: { $in: statusRegexIn(['UPHELD']) } },
        ],
      });
      break;
    case 'correctedClaim:corrected-claims-pending':
      appendAndCondition(filter, {
        correctedClaimStatus: { $nin: statusRegexIn(['SUBMITTED', 'CLOSED']) },
      });
      break;
    case 'correctedClaim:corrected-claims-submitted':
      appendAndCondition(filter, {
        $or: [
          { correctedClaimStatus: { $in: statusRegexIn(['SUBMITTED']) } },
          { submittedDate: { $exists: true, $ne: null } },
        ],
      });
      break;
    case 'correctedClaim:reopened-claims':
      appendAndCondition(filter, {
        clonedClaimId: { $exists: true, $ne: null },
      });
      break;
    case 'arWorkItem:ar':
      appendAndCondition(filter, {
        $or: [
          { nextFollowUpDate: { $lte: followUpCutoff } },
          { escalationFlag: true },
          { status: { $in: exactRegexIn(['open', 'pending', 'assigned', 'reopened']) } },
          { priority: { $in: exactRegexIn(['high', 'critical']) } },
        ],
      });
      break;
    case 'arWorkItem:open-ar-work-items':
      appendAndCondition(filter, openArStatusFilter);
      break;
    case 'arWorkItem:ar-total-balance':
      appendAndCondition(filter, {
        ...openArStatusFilter,
        balanceAmount: { $gt: 0 },
      });
      break;
    case 'arWorkItem:underpayment-amount':
      appendAndCondition(filter, {
        ...openArStatusFilter,
        category: { $in: statusRegexIn(['UNDERPAYMENT']) },
        $or: [
          { varianceAmount: { $gt: 0 } },
          { balanceAmount: { $gt: 0 } },
        ],
      });
      break;
    case 'patientBilling:patient-balance':
      appendAndCondition(filter, {
        $or: [
          { amountDue: { $gt: 0 } },
          { collectionsFlag: true },
          { statementStatus: { $in: exactRegexIn(['pending', 'overdue', 'sent', 'past due', 'payment plan']) } },
        ],
      });
      break;
    case 'patientBilling:patient-balance-total':
      appendAndCondition(filter, openPatientBillingFilter);
      break;
    case 'patientBilling:statements-ready':
      appendAndCondition(filter, {
        $or: [
          { status: { $in: statusRegexIn(['READY_TO_SEND', 'DRAFT']) } },
          { statementStatus: { $in: statusRegexIn(['READY_TO_SEND', 'DRAFT']) } },
        ],
      });
      break;
    case 'patientBilling:overdue-balances':
      appendAndCondition(filter, {
        ...openPatientBillingFilter,
        $or: [
          { status: { $in: statusRegexIn(['OVERDUE', 'PAST_DUE']) } },
          { statementStatus: { $in: statusRegexIn(['OVERDUE', 'PAST_DUE']) } },
          { dueDate: { $lte: now } },
        ],
      });
      break;
    case 'collection:collections':
    case 'collection:collections-active':
      appendAndCondition(filter, openCollectionFilter);
      break;
    case 'collection:collections-recovered':
      appendAndCondition(filter, {
        $or: [
          { recoveredAmount: { $gt: 0 } },
          { settlementAmount: { $gt: 0 } },
        ],
      });
      break;
    case 'collection:collection-write-offs':
      appendAndCondition(filter, {
        writeOffAmount: { $gt: 0 },
      });
      break;
    case 'refund:pending-review':
      appendAndCondition(filter, {
        refundStatus: { $in: statusRegexIn(['PENDING_REVIEW']) },
      });
      break;
    default:
      handled = false;
      break;
  }

  if (!handled && queue.startsWith('ar-aging-') && screenName === 'arWorkItem') {
    const bucket = queue.replace('ar-aging-', '').replace('plus', '+');
    appendAndCondition(filter, {
      ...openArStatusFilter,
      agingBucket: { $in: statusRegexIn([bucket]) },
    });
    return;
  }

  if (!handled && queue.startsWith('denial-category-') && screenName === 'denial') {
    const category = queue.replace('denial-category-', '').toUpperCase();
    appendAndCondition(filter, {
      ...openDenialFilter,
      denialCategory: { $in: statusRegexIn([category]) },
    });
    return;
  }

  if (!handled && queue.startsWith('denial-aging-') && screenName === 'denial') {
    const bucket = queue.replace('denial-aging-', '');
    appendAndCondition(filter, openDenialFilter);
    if (bucket === '0-30') {
      appendAndCondition(filter, {
        $or: [
          { denialDate: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          { denialDate: { $exists: false } },
          { denialDate: null },
        ],
      });
    } else if (bucket === '31-60') {
      appendAndCondition(filter, {
        denialDate: {
          $lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          $gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (bucket === '61-90') {
      appendAndCondition(filter, {
        denialDate: {
          $lt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (bucket === '90+' || bucket === '90plus') {
      appendAndCondition(filter, { denialDate: { $lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } });
    }
    return;
  }

  if (!handled) {
    appendAndCondition(filter, { _id: { $exists: false } });
  }
};

/**
 * generate list query
 */
export const generateListQuery = async (req: Request, screenName: string): Promise<ListQueryCriteria> => {
  const criteria: ListQueryCriteria = {
    limit: Number(config.limit),
    page: Number(config.page),
    sortfield: String(config.sortfield),
    direction: config.direction as 'asc' | 'desc',
    filter: { isDeleted: { $ne: true }, active: true },
    sorting: {},
    pagination: { limit: Number(config.limit), page: Number(config.page) }
  };

  if (req.query) {
    const data: any = req.query;
    if (data.limit) criteria.limit = criteria.pagination.limit = parseInt(data.limit);
    if (data.page) criteria.page = criteria.pagination.page = parseInt(data.page);

    if (data.filter) {
      const cred: ListQueryCred = typeof data.filter === 'string' ? JSON.parse(data.filter) : data.filter;
      if (cred.limit) criteria.limit = criteria.pagination.limit = Math.min(parseInt(String(cred.limit)), 200);
      if (cred.page) criteria.page = criteria.pagination.page = parseInt(String(cred.page));
      if (cred.sortfield) criteria.sortfield = cred.sortfield;
      if (cred.direction) criteria.direction = cred.direction;

      if (cred.globalSearch) buildGlobalSearch(screenName, cred.globalSearch, criteria.filter);
      if (cred.criteria) buildFilterCriteria(cred.criteria, criteria.filter, cred.isDateSearch);
      const hasExplicitCriteria = Array.isArray(cred.criteria) && cred.criteria.length > 0;

      if (!hasExplicitCriteria && cred.dashboardEntityId && Types.ObjectId.isValid(cred.dashboardEntityId)) {
        criteria.filter._id = new Types.ObjectId(cred.dashboardEntityId);
      } else if (cred.dashboardQueue) {
        appendDashboardQueueFilter(screenName, cred.dashboardQueue, criteria.filter);
      }
      
      if (cred.secondorySorting) {
        const secondary = cred.secondorySorting.reduce((acc: any, curr) => {
          acc[curr.field] = curr.direction === 'asc' ? 1 : -1;
          return acc;
        }, {});
        criteria.sorting = { ...criteria.sorting, ...secondary };
      }
    }
  }

  criteria.sorting[criteria.sortfield] = criteria.direction === 'desc' ? -1 : 1;
  return criteria;
};

export const encodeString = (str: string): string => Buffer.from(str).toString('base64');
export const decodeString = (str: string): string => Buffer.from(str, 'base64').toString();
export const jsUcfirst = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);
export const camelize = (str: string): string => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (l, i) => i === 0 ? l.toLowerCase() : l.toUpperCase()).replace(/\s+/g, '');
export const generateRandomNumber = (min: number, max: number): number => randomNumber({ min, max, integer: true });
export const createCryptoRandomString = (length: number): string => randomBase64String(length);

/**
 * Refactored Object Comparison
 */
export const compareObjects = async (obj1: any, obj2: any): Promise<string> => {
  let diff = '';
  
  const getDiff = async (o1: any, o2: any, parentKey = '') => {
    for (const key in o2) {
      if (key === '__v' || key === 'autofield' || key === 'updated' || key === 'updatedBy') continue;

      const val1 = o1[key];
      const val2 = o2[key];
      const displayKey = parentKey ? `${parentKey}.${key}` : key;

      if (_.isPlainObject(val2) && _.isPlainObject(val1)) {
        await getDiff(val1, val2, displayKey);
      } else if (val1 !== val2) {
        if (val1 === undefined || val1 === null) {
          diff += `${displayKey} added: ${val2}, `;
        } else {
          diff += `${displayKey} updated: ${val1} -> ${val2}, `;
        }
      }
    }
  };

  await getDiff(obj1, obj2);
  return diff.trim().replace(/,$/, '');
};

/**
 * Centralized Activity Logging Helper
 */
export const addActivity = async (req: Request, module: string, action: string, description: string, activityKey?: string) => {
  if (activityKey) {
    (req as any).activityKey = activityKey;
  }
  if (description) {
    (req as any).description = description;
  }
  
  await activityService.insertActivity(req);
};

/**
 * Dynamic Update Activity Logger
 */
export const logUpdateActivity = async (req: Request, oldDoc: any, newDoc: any, module: string, activityKey: string, identifierKey: string = 'email') => {
  if (oldDoc && newDoc) {
    const diff = await compareObjects(oldDoc.toObject ? oldDoc.toObject() : oldDoc, newDoc.toObject ? newDoc.toObject() : newDoc);
    if (diff) {
      const identifier = newDoc[identifierKey] || newDoc.title || newDoc.name || newDoc._id;
      await addActivity(req, module, 'Update', `Updated ${module} ${identifier}: ${diff}`, activityKey);
    }
  }
};

/**
 * Generic Bulk Soft Delete
 */
export const bulkDelete = async (model: Model<any>, ids: string[], updatedBy: string) => {
  return await model.updateMany(
    { _id: { $in: ids } },
    { active: false, isDeleted: true, deletedAt: new Date(), updatedBy, updated: new Date() }
  );
};

/**
 * Generic Bulk Update
 */
export const bulkUpdate = async (model: Model<any>, ids: string[], data: any, updatedBy: string) => {
  return await model.updateMany(
    { _id: { $in: ids } },
    { ...data, updatedBy, updated: new Date() }
  );
};

export const deleteFile = (path: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err) => err ? reject(err) : resolve());
  });
};

export default {
  generateUUID5,
  getBearerToken,
  generateUUID,
  generateRandomString,
  generateListQuery,
  getClientIp,
  encodeString,
  decodeString,
  jsUcfirst,
  camelize,
  generateRandomNumber,
  checkPermission,
  createCryptoRandomString,
  compareObjects,
  addActivity,
  logUpdateActivity,
  bulkDelete,
  bulkUpdate,
  deleteFile
};
