import axios from 'axios';
import { createHash } from 'crypto';
import FormData from 'form-data';
import { Types } from 'mongoose';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { envConfig } from '../../config/env.config';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { AppError } from '../../utils/error.util';
import { uploadService } from '../upload/upload.service';
import {
  MineCareActionStatus,
  MineCareAlertStatus,
  MineCareBreakdownRecord,
  MineCareChecklist,
  MineCareDowntimeScenario,
  MineCareEquipment,
  MineCareKnowledgeChunk,
  MineCareKnowledgeDocument,
  MineCareMaintenanceHistory,
  MineCareOperatorObservation,
  MineCareProcurementComparison,
  MineCareProcurementOption,
  MineCareRecommendation,
  MineCareRepairReplaceAnalysis,
  MineCareReportHistory,
  MineCareRootCauseAnalysis,
  MineCareServiceSchedule,
  MineCareSparePart,
  MineCareTechnician,
  MineCareVendorSla,
  MineCareWarranty,
  MineCareWarrantyClaimStatus,
} from './mineCareAi.model';
import type { IMineCareEquipment, MineCareCriticality, MineCareStatus } from './models/equipment.model';
import type { IMineCareOperatorObservation, MineCareObservationSeverity } from './models/operator-observation.model';

export type { MineCareCriticality, MineCareStatus };

type EquipmentPayload = Partial<Omit<IMineCareEquipment, '_id' | 'created' | 'updated'>> & {
  warranty?: Record<string, unknown>;
  serviceSchedules?: Array<Record<string, unknown>>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AI_ENRICHMENT_SYNC_WAIT_MS = 2500;
const DEFAULT_AI_ENRICHMENT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_AI_ENRICHMENT_CACHE_TTL_MS = 5 * 60 * 1000;
const mineCareAiEnrichmentCache = new Map<string, { expiresAt: number; value?: unknown; pending?: Promise<unknown> }>();

type MineCareReportPeriod = 'weekly' | 'monthly';

const now = () => new Date();
const addDays = (days: number) => {
  const date = now();
  date.setDate(date.getDate() + days);
  return date;
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateFrom(value: unknown, fallback: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function cleanStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function searchableTokens(value: unknown) {
  return text(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !['and', 'the', 'kit', 'set', 'return'].includes(item));
}

function resolveRequiredPartNumber(requiredPart: string, equipmentType: string, spareParts: any[]) {
  const normalizedRequiredPart = requiredPart.trim().toLowerCase();
  const exactPartNumber = spareParts.find((part) => String(part.partNumber ?? '').toLowerCase() === normalizedRequiredPart);
  if (exactPartNumber) return exactPartNumber.partNumber;

  const requiredTokens = searchableTokens(requiredPart);
  if (!requiredTokens.length) return requiredPart;

  const scoredParts = spareParts.map((part) => {
    const partNumber = text(part.partNumber);
    const partName = text(part.partName);
    const searchableText = `${partNumber} ${partName}`.toLowerCase();
    const partTokens = searchableTokens(searchableText);
    const compatibleEquipmentTypes = cleanStringArray(part.compatibleEquipmentTypes);
    const compatible = !equipmentType || !compatibleEquipmentTypes.length || compatibleEquipmentTypes.some((type) => type.toLowerCase() === equipmentType.toLowerCase());
    const tokenOverlap = requiredTokens.filter((token) => partTokens.includes(token) || searchableText.includes(token)).length;
    const phraseMatch = searchableText.includes(normalizedRequiredPart) ? 3 : 0;
    const lastTokenMatch = partTokens.includes(requiredTokens[requiredTokens.length - 1]) ? 1 : 0;
    return {
      part,
      compatible,
      score: compatible ? tokenOverlap + phraseMatch + lastTokenMatch : 0,
    };
  }).sort((left, right) => right.score - left.score || Number(right.compatible) - Number(left.compatible));

  const bestPart = scoredParts[0];
  return bestPart && bestPart.score >= 3 ? bestPart.part.partNumber : requiredPart;
}

function inferMineCareDocumentType(fileName: string, requestedType?: unknown) {
  const explicitType = text(requestedType);
  const allowedTypes = ['Manual', 'SOP', 'Warranty', 'OEM Schedule', 'Invoice', 'Purchase Order', 'Service Document', 'Other'];
  if (explicitType && explicitType !== 'Other' && allowedTypes.includes(explicitType)) return explicitType;

  const normalized = fileName.toLowerCase();
  if (/\b(invoice|bill|tax-invoice)\b/.test(normalized)) return 'Invoice';
  if (/\b(purchase[-_\s]?order|po[-_\s]?\d*|quotation|quote)\b/.test(normalized)) return 'Purchase Order';
  if (/\b(warranty|guarantee|coverage)\b/.test(normalized)) return 'Warranty';
  if (/\b(oem|service[-_\s]?schedule|maintenance[-_\s]?schedule|pm[-_\s]?schedule)\b/.test(normalized)) return 'OEM Schedule';
  if (/\b(manual|guide|handbook|catalogue|catalog)\b/.test(normalized)) return 'Manual';
  if (/\b(sop|procedure|work[-_\s]?instruction)\b/.test(normalized)) return 'SOP';
  if (/\b(service|maintenance|inspection|commissioning|handover)\b/.test(normalized)) return 'Service Document';
  return explicitType && allowedTypes.includes(explicitType) ? explicitType : 'Other';
}

async function consumeServiceRequiredParts(requiredParts: string[], equipmentType: string) {
  if (!requiredParts.length) return [];
  const spareParts = await MineCareSparePart.find({ isDeleted: false, active: true }).lean();
  const inventoryPartNumbers = new Set(spareParts.map((part) => part.partNumber));
  const demand = new Map<string, number>();

  requiredParts.forEach((requiredPart) => {
    const partNumber = resolveRequiredPartNumber(requiredPart, equipmentType, spareParts);
    if (!inventoryPartNumbers.has(partNumber)) return;
    demand.set(partNumber, (demand.get(partNumber) ?? 0) + 1);
  });

  const consumedParts = [];
  for (const [partNumber, quantity] of demand.entries()) {
    const part = await MineCareSparePart.findOne({ partNumber, isDeleted: false, active: true });
    if (!part) continue;
    const beforeStock = part.currentStock;
    const consumedQuantity = Math.min(quantity, beforeStock);
    part.currentStock = Math.max(0, beforeStock - quantity);
    part.updated = now();
    await part.save();
    consumedParts.push({
      partNumber,
      partName: part.partName,
      requestedQuantity: quantity,
      consumedQuantity,
      beforeStock,
      afterStock: part.currentStock,
      shortageQuantity: Math.max(0, quantity - beforeStock),
    });
  }
  return consumedParts;
}

function statusKey(...parts: unknown[]) {
  return parts
    .map((part) => String(part ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-');
}

function serializeEquipment(item: any) {
  return {
    ...item,
    model: item.model ?? item.modelName ?? '',
  };
}

function equipmentIdentifierFilter(identifier: string) {
  const filters: Array<Record<string, unknown>> = [{ equipmentId: identifier }];
  if (Types.ObjectId.isValid(identifier)) {
    filters.push({ _id: new Types.ObjectId(identifier) });
  }
  return { $or: filters, isDeleted: false };
}

function agenticServerBaseUrl() {
  const configuredUrl = (process.env.AGENTIC_SERVER_URL || envConfig.crewaiApiUrl || 'http://localhost:8007/api/v1').trim();
  const trimmedUrl = configuredUrl.replace(/\/$/, '');
  return /\/api\/v\d+$/i.test(trimmedUrl) ? trimmedUrl : `${trimmedUrl}/api/v1`;
}

function agenticHeaders(extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  const agenticApiKey = process.env.AGENTIC_SERVER_API_KEY || process.env.CREWAI_API_KEY;
  if (agenticApiKey) headers['x-agentic-api-key'] = agenticApiKey;
  return headers;
}

async function postAgenticJson<T>(path: string, payload: unknown, fallback: T): Promise<T & { aiProvider?: string }> {
  try {
    const response = await axios.post(`${agenticServerBaseUrl()}${path}`, payload, {
      headers: agenticHeaders(),
      timeout: Number(process.env.MINECARE_AI_PHASE2_TIMEOUT_MS || 90000),
    });
    return { ...(response.data as T), aiProvider: 'agentic-server' };
  } catch (_error) {
    return { ...(fallback as any), aiProvider: 'deterministic-fallback' };
  }
}

function enrichmentNumberEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date));
}

function canAiReplaceNumber(key: string) {
  return /confidence|probability|aiPriorityScore/i.test(key);
}

function isProtectedAiMergeKey(key: string) {
  return ['_id', 'id', 'equipmentId', 'equipment', 'equipmentName', 'partNumber', 'breakdownId', 'analysisId', 'checklistId', 'documentId', 'recommendationId', 'status', 'created', 'updated', 'deletedAt'].includes(key);
}

function mergeAiValue(fallback: unknown, aiValue: unknown, key = ''): unknown {
  if (isProtectedAiMergeKey(key)) return fallback;

  if (Array.isArray(fallback)) {
    if (!Array.isArray(aiValue) || !aiValue.length) return fallback;
    if (fallback.every((item) => typeof item === 'string')) {
      const values = cleanStringArray(aiValue);
      return values.length ? values : fallback;
    }
    return fallback.map((item, index) => mergeAiValue(item, aiValue[index], key));
  }

  if (isRecord(fallback)) {
    const source = isRecord(aiValue) ? aiValue : {};
    return Object.entries(fallback).reduce<Record<string, unknown>>((next, [childKey, childValue]) => {
      next[childKey] = mergeAiValue(childValue, source[childKey], childKey);
      return next;
    }, {});
  }

  if (typeof fallback === 'string') return typeof aiValue === 'string' && aiValue.trim() ? aiValue.trim() : fallback;
  if (typeof fallback === 'number') return canAiReplaceNumber(key) ? number(aiValue, fallback) : fallback;
  return fallback;
}

function enrichmentCacheKey(feature: string, fallback: unknown, context: unknown, task: string) {
  return createHash('sha1')
    .update(JSON.stringify({ feature, fallback, context, task }, (_key, value) => value instanceof Date ? value.toISOString() : value))
    .digest('hex');
}

async function requestMineCareAiEnrichment<T>(feature: string, fallback: T, context: unknown, task: string): Promise<T> {
  const response = await axios.post(`${agenticServerBaseUrl()}/minecare-ai/insights/enrich`, {
    feature,
    fallback,
    context,
    task,
  }, {
    headers: agenticHeaders(),
    timeout: enrichmentNumberEnv('MINECARE_AI_ENRICHMENT_REQUEST_TIMEOUT_MS', DEFAULT_AI_ENRICHMENT_REQUEST_TIMEOUT_MS),
  });
  return mergeAiValue(fallback, response.data) as T;
}

function withEnrichmentWait<T>(promise: Promise<T>, fallback: T, waitMs: number): Promise<T> {
  if (waitMs <= 0) return Promise.resolve(fallback);
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), waitMs);
    }),
  ]);
}

async function enrichMineCareAi<T>(feature: string, fallback: T, context: unknown = {}, task = ''): Promise<T> {
  if (process.env.MINECARE_AI_DISABLE_ENRICHMENT === 'true') return fallback;
  if (Array.isArray(fallback) && fallback.length === 0) return fallback;

  const key = enrichmentCacheKey(feature, fallback, context, task);
  const cached = mineCareAiEnrichmentCache.get(key);
  const nowMs = Date.now();
  if (cached?.value && cached.expiresAt > nowMs) return cached.value as T;

  const cacheTtlMs = enrichmentNumberEnv('MINECARE_AI_ENRICHMENT_CACHE_TTL_MS', DEFAULT_AI_ENRICHMENT_CACHE_TTL_MS);
  const syncWaitMs = process.env.MINECARE_AI_ENRICHMENT_MODE === 'sync'
    ? enrichmentNumberEnv('MINECARE_AI_ENRICHMENT_REQUEST_TIMEOUT_MS', DEFAULT_AI_ENRICHMENT_REQUEST_TIMEOUT_MS)
    : enrichmentNumberEnv('MINECARE_AI_ENRICHMENT_SYNC_WAIT_MS', DEFAULT_AI_ENRICHMENT_SYNC_WAIT_MS);

  const pending = cached?.pending as Promise<T> | undefined;
  if (pending) return withEnrichmentWait(pending, fallback, syncWaitMs);

  const request = requestMineCareAiEnrichment(feature, fallback, context, task)
    .then((value) => {
      mineCareAiEnrichmentCache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
      return value;
    })
    .catch(() => {
      mineCareAiEnrichmentCache.delete(key);
      return fallback;
    });

  mineCareAiEnrichmentCache.set(key, { pending: request, expiresAt: nowMs + cacheTtlMs });
  const value = await withEnrichmentWait(request, fallback, syncWaitMs);
  if (value !== fallback) {
    mineCareAiEnrichmentCache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
  }
  return value;
}

function compactMineCareContext(context: Record<string, any>) {
  return {
    equipment: (context.equipment ?? []).slice(0, 12),
    warranties: (context.warranties ?? []).slice(0, 12),
    schedules: (context.schedules ?? []).slice(0, 12),
    maintenanceHistory: (context.maintenanceHistory ?? []).slice(0, 12),
    breakdowns: (context.breakdowns ?? []).slice(0, 12),
    observations: (context.observations ?? []).slice(0, 12),
    spareParts: (context.spareParts ?? []).slice(0, 12),
    rootCauses: (context.rootCauses ?? []).slice(0, 10),
    checklists: (context.checklists ?? []).slice(0, 10),
    vendorSlas: (context.vendorSlas ?? []).slice(0, 10),
    repairReplaceAnalyses: (context.repairReplaceAnalyses ?? []).slice(0, 10),
    downtimeScenarios: (context.downtimeScenarios ?? []).slice(0, 10),
    procurementComparisons: (context.procurementComparisons ?? []).slice(0, 10),
  };
}

function normalizeStatus(value: unknown): MineCareStatus {
  const normalized = text(value, 'Operational');
  if (normalized === 'Under Maintenance' || normalized === 'Breakdown' || normalized === 'Retired') return normalized;
  return 'Operational';
}

function normalizeCriticality(value: unknown): MineCareCriticality {
  const normalized = text(value, 'Medium');
  if (normalized === 'Low' || normalized === 'High' || normalized === 'Critical') return normalized;
  return 'Medium';
}

function normalizeSeverity(value: unknown): MineCareObservationSeverity {
  const normalized = text(value, 'Medium');
  if (normalized === 'Low' || normalized === 'High' || normalized === 'Critical') return normalized;
  return 'Medium';
}

async function seedMineCareSampleData() {
  return;
}

async function seedMineCarePhase2SampleData() {
  return;
}

async function loadMineCareContext() {
  await seedMineCareSampleData();
  const [equipmentRecords, warranties, schedules, maintenanceHistory, breakdowns, observations, spareParts, alertStatuses, actionStatuses, warrantyClaimStatuses] = await Promise.all([
    MineCareEquipment.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareWarranty.find({ isDeleted: false }).lean(),
    MineCareServiceSchedule.find({ isDeleted: false }).lean(),
    MineCareMaintenanceHistory.find({ isDeleted: false }).lean(),
    MineCareBreakdownRecord.find({ isDeleted: false }).lean(),
    MineCareOperatorObservation.find({ isDeleted: false }).lean(),
    MineCareSparePart.find({ isDeleted: false }).lean(),
    MineCareAlertStatus.find({ isDeleted: false }).lean(),
    MineCareActionStatus.find({ isDeleted: false }).lean(),
    MineCareWarrantyClaimStatus.find({ isDeleted: false }).lean(),
  ]);

  return { equipment: equipmentRecords.map(serializeEquipment), warranties, schedules, maintenanceHistory, breakdowns, observations, spareParts, alertStatuses, actionStatuses, warrantyClaimStatuses };
}

function findEquipment(context: Awaited<ReturnType<typeof loadMineCareContext>>, identifier: string) {
  return context.equipment.find((item) => String(item._id) === identifier || item.equipmentId === identifier);
}

function findSchedule(context: Awaited<ReturnType<typeof loadMineCareContext>>, item: any) {
  return context.schedules.find((schedule) =>
    (schedule.equipmentId && schedule.equipmentId === item.equipmentId) ||
    schedule.equipmentType.toLowerCase() === item.type.toLowerCase()
  );
}

function calculateServiceDue(context: Awaited<ReturnType<typeof loadMineCareContext>>, item: any) {
  const schedule = findSchedule(context, item);
  if (!schedule) return null;
  const interval = Math.max(1, schedule.intervalHours);
  const nextServiceHours = Math.ceil((item.currentRunningHours + 1) / interval) * interval;
  const remainingHours = nextServiceHours - item.currentRunningHours;
  const remainingDays = item.averageDailyUsage > 0 ? Math.ceil(remainingHours / item.averageDailyUsage) : 999;
  const serviceDueDate = addDays(remainingDays);
  const lastService = context.maintenanceHistory
    .filter((history) => history.equipmentId === item.equipmentId)
    .sort((left, right) => right.serviceDate.getTime() - left.serviceDate.getTime())[0] ?? null;

  const status = remainingDays <= 0 ? 'Overdue' : remainingDays <= 7 ? 'Due This Week' : remainingDays <= 30 ? 'Upcoming' : 'Scheduled';
  const delayRisk = remainingDays <= 0 ? 'Critical' : remainingDays <= 3 ? 'High' : remainingDays <= 14 ? 'Medium' : 'Low';
  const aiPriority = item.criticality === 'Critical' && remainingDays <= 7 ? 'Critical' : delayRisk;
  return {
    equipmentId: item.equipmentId,
    equipmentName: item.name,
    serviceName: schedule.serviceName,
    nextServiceHours,
    remainingHours,
    remainingDays,
    serviceDueDate,
    estimatedCost: schedule.estimatedCost,
    requiredParts: schedule.requiredParts,
    status,
    aiPriority,
    delayRisk,
    aiReason: `${schedule.serviceName} is ${status.toLowerCase()} with ${remainingHours} running hour(s) remaining on a ${item.criticality.toLowerCase()} asset.`,
    aiRecommendedAction: remainingDays <= 0
      ? `Stop non-critical dispatch and complete ${schedule.serviceName} before the next production cycle.`
      : remainingDays <= 7
        ? `Reserve ${schedule.requiredParts.join(', ') || 'required parts'} and schedule ${schedule.serviceName} this week.`
        : `Plan ${schedule.serviceName} around production windows and confirm parts before lead time risk increases.`,
    lastService,
  };
}

function calculateWarrantyStatus(context: Awaited<ReturnType<typeof loadMineCareContext>>, item: any) {
  const warranty = context.warranties.find((candidate) => candidate.equipmentId === item.equipmentId);
  if (!warranty) return { equipmentId: item.equipmentId, equipmentName: item.name, status: 'No Warranty', remainingDays: 0, remainingHours: 0, warranty: null, aiRecommendation: 'Confirm warranty coverage before approving major repair spend.' };
  const remainingDays = Math.ceil((warranty.endDate.getTime() - Date.now()) / DAY_MS);
  const remainingHours = warranty.hourLimit - item.currentRunningHours;
  const expired = remainingDays < 0 || remainingHours <= 0;
  const status = expired ? 'Expired' : remainingDays <= 30 || remainingHours <= 250 ? 'Expiring Soon' : 'Active';
  return {
    equipmentId: item.equipmentId,
    equipmentName: item.name,
    status,
    remainingDays,
    remainingHours,
    warranty,
    aiRecommendation: status === 'Expired'
      ? 'Do not assume recoverability; route failures through paid repair or goodwill review.'
      : status === 'Expiring Soon'
        ? 'Audit open defects, observations, and breakdowns before warranty coverage expires.'
        : 'Keep warranty terms attached to future breakdown reviews for claim screening.',
  };
}

function calculateHealthScore(context: Awaited<ReturnType<typeof loadMineCareContext>>, item: any) {
  const due = calculateServiceDue(context, item);
  const warranty = calculateWarrantyStatus(context, item);
  const itemBreakdowns = context.breakdowns.filter((record) => record.equipmentId === item.equipmentId);
  const itemObservations = context.observations.filter((record) => record.equipmentId === item.equipmentId);
  const observationRisk = Math.min(20, itemObservations.reduce((sum, record) => sum + (record.severity === 'Critical' ? 12 : record.severity === 'High' ? 8 : record.severity === 'Medium' ? 5 : 2), 0));
  const breakdownRisk = Math.min(28, itemBreakdowns.length * 8 + itemBreakdowns.reduce((sum, record) => sum + record.downtimeHours, 0) * 0.25);
  const serviceDelayRisk = due ? Math.max(0, 30 - due.remainingDays) * 0.6 : 8;
  const highUsageRisk = item.averageDailyUsage >= 14 ? 14 : item.averageDailyUsage >= 10 ? 8 : 2;
  const warrantyExpiryRisk = warranty.status === 'Expired' ? 12 : warranty.status === 'Expiring Soon' ? 8 : 0;
  const score = Math.max(0, Math.round(100 - serviceDelayRisk - breakdownRisk - highUsageRisk - observationRisk - warrantyExpiryRisk));
  const status = score >= 80 ? 'Good' : score >= 60 ? 'Medium' : score >= 40 ? 'High Risk' : 'Critical';
  return {
    equipmentId: item.equipmentId,
    score,
    status,
    riskLevel: status,
    components: { serviceDelayRisk: Math.round(serviceDelayRisk), breakdownRisk: Math.round(breakdownRisk), highUsageRisk, observationRisk, warrantyExpiryRisk },
    recommendations: [
      due && due.remainingDays <= 7 ? `${due.serviceName} is due within ${Math.max(0, due.remainingDays)} day(s).` : null,
      warranty.status === 'Expiring Soon' ? 'Review warranty coverage before authorizing non-emergency repairs.' : null,
      itemObservations.some((record) => record.severity === 'High' || record.severity === 'Critical') ? 'Inspect recent operator observations before the next shift.' : null,
    ].filter(Boolean),
  };
}

function calculateRiskRankingFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const criticalityWeight: Record<MineCareCriticality, number> = { Low: 5, Medium: 12, High: 20, Critical: 30 };
  return context.equipment.map((item) => {
    const due = calculateServiceDue(context, item);
    const warranty = calculateWarrantyStatus(context, item);
    const health = calculateHealthScore(context, item);
    const itemBreakdowns = context.breakdowns.filter((record) => record.equipmentId === item.equipmentId);
    const downtime = itemBreakdowns.reduce((sum, record) => sum + record.downtimeHours, 0);
    const repairCost = itemBreakdowns.reduce((sum, record) => sum + record.repairCost, 0);
    const observationPenalty = context.observations
      .filter((record) => record.equipmentId === item.equipmentId)
      .reduce((sum, record) => sum + (record.severity === 'Critical' ? 15 : record.severity === 'High' ? 10 : record.severity === 'Medium' ? 5 : 1), 0);
    const score = criticalityWeight[item.criticality as MineCareCriticality] + (due && due.remainingDays <= 7 ? 25 : due && due.remainingDays <= 30 ? 10 : 0) + itemBreakdowns.length * 8 + downtime * 0.3 + repairCost / 2000 + (warranty.status === 'Expiring Soon' ? 10 : warranty.status === 'Expired' ? 8 : 0) + observationPenalty + (100 - health.score) * 0.35;
    const priority = score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 30 ? 'Medium' : 'Low';
    const reasons = [
      item.criticality === 'Critical' ? 'Critical production asset' : null,
      due && due.remainingDays <= 7 ? 'Service due this week' : null,
      itemBreakdowns.length ? `${itemBreakdowns.length} breakdown record(s)` : null,
      warranty.status === 'Expiring Soon' ? 'Warranty expiring soon' : null,
      observationPenalty > 0 ? 'Recent operator observations' : null,
    ].filter(Boolean);
    return {
      equipmentId: item.equipmentId,
      equipmentName: item.name,
      type: item.type,
      criticality: item.criticality,
      score: Math.round(score),
      priority,
      healthScore: health.score,
      reasons,
      aiExplanation: `${item.name} is ranked ${priority.toLowerCase()} because ${reasons.join(', ') || 'its composite maintenance risk is currently low'}. Health score is ${health.score} with risk score ${Math.round(score)}.`,
      nextBestAction: priority === 'Critical'
        ? 'Create an immediate maintenance review with service history, observations, and spare readiness.'
        : priority === 'High'
          ? 'Schedule inspection in the next planning window and pre-check warranty coverage.'
          : 'Continue monitoring and keep preventive service plan current.',
    };
  }).sort((left, right) => right.score - left.score);
}

function serviceCalendarFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const services = context.equipment.map((item) => calculateServiceDue(context, item)).filter(Boolean) as any[];
  const overdueServices = services.filter((service) => service.remainingDays <= 0);
  const weeklyCalendar = services.filter((service) => service.remainingDays <= 7);
  const warrantyInspections = context.equipment.map((item) => calculateWarrantyStatus(context, item)).filter((warranty) => warranty.status === 'Expiring Soon');
  return {
    weeklyCalendar,
    monthlyCalendar: services.filter((service) => service.remainingDays <= 30),
    upcomingServices: services.filter((service) => service.remainingDays > 0).sort((left, right) => left.remainingDays - right.remainingDays),
    overdueServices,
    warrantyInspections,
    aiSummary: `${overdueServices.length} overdue service(s), ${weeklyCalendar.length} due this week, and ${warrantyInspections.length} warranty inspection(s) need planning attention.`,
    aiRecommendedPlan: [
      overdueServices.length ? 'Clear overdue services before assigning additional production hours.' : 'No overdue services detected; maintain weekly service plan.',
      weeklyCalendar.length ? 'Reserve labor and required parts for due-this-week work.' : 'Use available service capacity for inspections and backlog cleanup.',
      warrantyInspections.length ? 'Bundle warranty inspections with upcoming service windows.' : 'No urgent warranty inspection bundle required.',
    ],
  };
}

function warrantyClaimsFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  return context.breakdowns.flatMap((breakdown) => {
    const item = context.equipment.find((candidate) => candidate.equipmentId === breakdown.equipmentId);
    if (!item) return [];
    const warranty = context.warranties.find((candidate) => candidate.equipmentId === item.equipmentId);
    if (!warranty) return [];
    const withinDate = breakdown.breakdownDate >= warranty.startDate && breakdown.breakdownDate <= warranty.endDate;
    const withinHours = item.currentRunningHours <= warranty.hourLimit;
    if (!withinDate && !withinHours) return [];
    const id = statusKey('claim', item.equipmentId, String(breakdown._id));
    const savedStatus = context.warrantyClaimStatuses.find((status) => status.claimId === id);
    const coveredMatch = warranty.coveredComponents.some((component) => `${breakdown.failureType} ${breakdown.component ?? ''}`.toLowerCase().includes(component.toLowerCase()));
    const claimProbability = Math.min(0.95, Math.max(0.35, (withinDate ? 0.28 : 0) + (withinHours ? 0.28 : 0) + (coveredMatch ? 0.24 : 0) + (breakdown.repairCost > 0 ? 0.12 : 0)));
    return [{
      id,
      equipmentId: item.equipmentId,
      equipmentName: item.name,
      breakdownId: String(breakdown._id),
      failureType: breakdown.failureType,
      component: breakdown.component,
      breakdownDate: breakdown.breakdownDate,
      potentialClaim: true,
      status: savedStatus?.status ?? 'Potential',
      recoverableCost: Math.round(breakdown.repairCost * 0.75),
      recommendation: `Check ${breakdown.failureType} against covered components: ${warranty.coveredComponents.join(', ')}.`,
      claimProbability,
      missingDocuments: ['Warranty certificate', 'Breakdown report', 'Repair estimate', 'Running-hours log'].filter((document) => document !== 'Running-hours log' || !withinHours),
      aiExplanation: `MineCare AI estimates ${Math.round(claimProbability * 100)}% claim fit based on warranty dates, hour limit, covered components, and repair cost evidence.`,
    }];
  });
}

function forecastSparePartsFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const upcomingServices = context.equipment
    .map((item) => calculateServiceDue(context, item))
    .filter((due): due is NonNullable<typeof due> => Boolean(due && due.remainingDays <= 45));
  const demand = new Map<string, number>();
  const demandSources = new Map<string, string[]>();
  upcomingServices.forEach((due) => {
    const equipment = context.equipment.find((item) => item.equipmentId === due.equipmentId);
    due.requiredParts.forEach((requiredPart: string) => {
      const partNumber = resolveRequiredPartNumber(requiredPart, equipment?.type ?? '', context.spareParts);
      demand.set(partNumber, (demand.get(partNumber) ?? 0) + 1);
      const source = `${due.equipmentId} - ${due.serviceName}`;
      const sources = demandSources.get(partNumber) ?? [];
      if (!sources.includes(source)) demandSources.set(partNumber, [...sources, source]);
    });
  });
  const inventoryPartNumbers = new Set(context.spareParts.map((part) => part.partNumber));
  const forecast = context.spareParts.map((part) => {
    const requiredQuantity = demand.get(part.partNumber) ?? 0;
    const projectedStock = part.currentStock - requiredQuantity;
    const reorderQuantity = Math.max(0, part.minimumStock - projectedStock);
    const shortageRisk = projectedStock < 0 ? 'Critical' : projectedStock < part.minimumStock ? 'High' : requiredQuantity > 0 ? 'Medium' : 'Low';
    return {
      ...part,
      requiredQuantity,
      demandSources: demandSources.get(part.partNumber) ?? [],
      projectedStock,
      reorderRecommended: reorderQuantity > 0,
      reorderQuantity,
      reorderCost: reorderQuantity * part.unitCost,
      shortageRisk,
      aiRecommendation: reorderQuantity > 0
        ? `Order ${reorderQuantity} unit(s) now; ${part.leadTimeDays}-day lead time can delay upcoming services.`
        : requiredQuantity > 0
          ? 'Stock covers forecast demand; monitor after scheduled service completion.'
          : 'No immediate service demand detected for this part.',
      stockingStrategy: shortageRisk === 'Critical' || shortageRisk === 'High' ? 'Expedite purchase and confirm substitute availability.' : 'Maintain normal reorder monitoring.',
    };
  });
  const missingParts = Array.from(demand.entries()).filter(([partNumber]) => !inventoryPartNumbers.has(partNumber)).map(([partNumber, requiredQuantity]) => ({
    _id: `missing-${statusKey(partNumber)}`,
    partNumber,
    partName: partNumber,
    currentStock: 0,
    minimumStock: requiredQuantity,
    leadTimeDays: 0,
    unitCost: 0,
    requiredQuantity,
    demandSources: demandSources.get(partNumber) ?? [],
    projectedStock: -requiredQuantity,
    reorderRecommended: true,
    reorderQuantity: requiredQuantity,
    reorderCost: 0,
    shortageRisk: 'Critical',
    aiRecommendation: 'No matching compatible inventory item found. Add this part to the spare-parts master or map it to an approved substitute.',
    stockingStrategy: 'Create inventory master entry, confirm compatible supplier part number, and procure before the service window.',
  }));
  return [...forecast, ...missingParts];
}

function alertsFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const statusById = new Map(context.alertStatuses.map((item) => [item.alertId, item.status]));
  const enrichAlert = (alert: any) => {
    const score = (alert.severity === 'Critical' ? 95 : alert.severity === 'High' ? 78 : alert.severity === 'Medium' ? 55 : 30) + (alert.type === 'Service Overdue' ? 8 : alert.type === 'Critical Asset' ? 6 : 0);
    return {
      ...alert,
      aiPriorityScore: Math.min(100, score),
      aiReason: `${alert.type} is prioritized as ${alert.severity} because ${alert.message}`,
      recommendedAction: alert.type === 'Service Overdue'
        ? 'Block non-critical dispatch until service completion is confirmed.'
        : alert.type === 'Service Due'
          ? 'Reserve labor and parts in the current planning window.'
          : alert.type === 'Warranty Alert'
            ? 'Review open failures and submit eligible warranty evidence.'
            : alert.type === 'Part Shortage'
              ? 'Expedite reorder and identify substitute parts before service starts.'
              : 'Assign maintenance owner for immediate risk review.',
    };
  };
  const serviceAlerts = context.equipment.flatMap((item) => {
    const due = calculateServiceDue(context, item);
    if (!due || due.remainingDays > 14) return [];
    const id = statusKey('service', item.equipmentId, due.serviceName, due.serviceDueDate.toISOString());
    return [{ id, type: due.remainingDays <= 0 ? 'Service Overdue' : 'Service Due', severity: due.remainingDays <= 0 ? 'Critical' : due.remainingDays <= 7 ? 'High' : 'Medium', status: statusById.get(id) ?? 'Open', equipmentId: item.equipmentId, equipmentName: item.name, message: `${due.serviceName} is ${due.remainingDays <= 0 ? 'overdue' : `due in ${due.remainingDays} day(s)`}.`, dueDate: due.serviceDueDate }];
  });
  const warrantyAlerts = context.equipment.flatMap((item) => {
    const warranty = calculateWarrantyStatus(context, item);
    if (warranty.status !== 'Expiring Soon' && warranty.status !== 'Expired') return [];
    const id = statusKey('warranty', item.equipmentId, warranty.status);
    return [{ id, type: 'Warranty Alert', severity: warranty.status === 'Expired' ? 'High' : 'Medium', status: statusById.get(id) ?? 'Open', equipmentId: item.equipmentId, equipmentName: item.name, message: `${warranty.status}: ${warranty.remainingDays} day(s), ${warranty.remainingHours} hour(s) remaining.` }];
  });
  const inventoryAlerts = context.spareParts.filter((part) => part.currentStock <= part.minimumStock).map((part) => {
    const id = statusKey('inventory', part.partNumber);
    return { id, type: 'Part Shortage', severity: part.currentStock < part.minimumStock ? 'High' : 'Medium', status: statusById.get(id) ?? 'Open', partNumber: part.partNumber, partName: part.partName, message: `${part.partName} stock is ${part.currentStock}; minimum is ${part.minimumStock}.` };
  });
  const assetAlerts = calculateRiskRankingFromContext(context).filter((risk) => risk.priority === 'Critical').map((risk) => {
    const id = statusKey('asset-risk', risk.equipmentId);
    return { id, type: 'Critical Asset', severity: 'Critical', status: statusById.get(id) ?? 'Open', equipmentId: risk.equipmentId, equipmentName: risk.equipmentName, message: `${risk.equipmentName} is ranked critical: ${risk.reasons.join(', ') || 'high composite risk'}.` };
  });
  return [...serviceAlerts, ...warrantyAlerts, ...inventoryAlerts, ...assetAlerts]
    .map(enrichAlert)
    .sort((left, right) => right.aiPriorityScore - left.aiPriorityScore);
}

function actionCenterFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const statusById = new Map(context.actionStatuses.map((item) => [item.actionId, item.status]));
  const serviceActions = context.equipment.flatMap((item) => {
    const due = calculateServiceDue(context, item);
    if (!due || due.remainingDays > 14) return [];
    const id = statusKey('service-action', item.equipmentId, due.serviceName);
    return [{ id, priority: due.remainingDays <= 3 ? 'Critical' : due.remainingDays <= 7 ? 'High' : 'Medium', status: statusById.get(id) ?? 'Open', equipment: item.equipmentId, equipmentName: item.name, action: due.serviceName, source: 'Service Due Prediction', dueDate: due.serviceDueDate }];
  });
  const warrantyActions = context.equipment.flatMap((item) => {
    const warranty = calculateWarrantyStatus(context, item);
    if (warranty.status !== 'Expiring Soon') return [];
    const id = statusKey('warranty-action', item.equipmentId);
    return [{ id, priority: 'Medium', status: statusById.get(id) ?? 'Open', equipment: item.equipmentId, equipmentName: item.name, action: 'Review warranty before repair approval', source: 'Warranty Tracker' }];
  });
  const riskActions = calculateRiskRankingFromContext(context).filter((risk) => risk.priority === 'Critical' || risk.priority === 'High').map((risk) => {
    const id = statusKey('risk-action', risk.equipmentId);
    return { id, priority: risk.priority, status: statusById.get(id) ?? 'Open', equipment: risk.equipmentId, equipmentName: risk.equipmentName, action: risk.reasons[0] || 'Maintenance risk review', source: 'Risk Ranking' };
  });
  const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return [...serviceActions, ...warrantyActions, ...riskActions].sort((left, right) => (priorityOrder[left.priority] ?? 9) - (priorityOrder[right.priority] ?? 9)).slice(0, 12);
}

function budgetFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const upcomingServices = context.equipment.map((item) => calculateServiceDue(context, item)).filter((due): due is NonNullable<typeof due> => Boolean(due && due.remainingDays <= 30));
  const serviceCost = upcomingServices.reduce((sum, due) => sum + due.estimatedCost, 0);
  const highRiskAssets = calculateRiskRankingFromContext(context).filter((risk) => risk.priority === 'Critical' || risk.priority === 'High');
  const riskBuffer = Math.round(highRiskAssets.reduce((sum, risk) => sum + risk.score * 80, 0));
  const costExposure = Math.round(serviceCost + riskBuffer + context.breakdowns.reduce((sum, record) => sum + record.repairCost, 0) * 0.2);
  const potentialSavings = warrantyClaimsFromContext(context).reduce((sum, claim) => sum + claim.recoverableCost, 0);
  const costDrivers = [
    upcomingServices.length ? `${upcomingServices.length} upcoming service event(s)` : '',
    highRiskAssets.length ? `${highRiskAssets.length} high-risk asset(s)` : '',
    context.breakdowns.length ? `${context.breakdowns.length} breakdown record(s)` : '',
    potentialSavings > 0 ? 'warranty recovery opportunity' : '',
  ].filter(Boolean);
  return {
    month: now().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    monthlyMaintenanceBudget: serviceCost + riskBuffer,
    serviceCost,
    riskBuffer,
    costExposure,
    potentialSavings,
    upcomingServiceCount: upcomingServices.length,
    costDrivers,
    aiNarrative: `MineCare AI projects ${costExposure} cost exposure from ${costDrivers.join(', ') || 'normal planned maintenance'}. Potential warranty recovery is ${potentialSavings}.`,
    recommendedActions: [
      highRiskAssets.length ? 'Prioritize high-risk assets before approving discretionary work.' : 'Maintain the planned maintenance budget.',
      potentialSavings > 0 ? 'Submit warranty claim packages before month-end close.' : 'Keep warranty screening active for new breakdowns.',
      upcomingServices.length ? 'Reserve parts and labor for the upcoming service window.' : 'Use available capacity for inspections and backlog cleanup.',
    ],
  };
}

function calculateMineCareSavings(context: Awaited<ReturnType<typeof loadMineCareContext>>, extras: Record<string, any[]> = {}) {
  const ranking = calculateRiskRankingFromContext(context);
  const highRiskDowntimeHours = ranking
    .filter((risk) => risk.priority === 'Critical' || risk.priority === 'High')
    .reduce((sum, risk) => {
      const breakdownHours = context.breakdowns.filter((item) => item.equipmentId === risk.equipmentId).reduce((total, item) => total + item.downtimeHours, 0);
      return sum + Math.max(6, breakdownHours * 0.35);
    }, 0);
  const downtimeScenarioSavings = (extras.downtimeScenarios ?? []).reduce((sum, item) => sum + number(item.productionLoss, 0) * number(item.failureProbability, 0.25), 0);
  const estimatedDowntimeAvoided = Math.round(highRiskDowntimeHours * 9500 + downtimeScenarioSavings);
  const warrantyRecoveryOpportunity = warrantyClaimsFromContext(context).reduce((sum, claim) => sum + claim.recoverableCost, 0);
  const upcomingServices = context.equipment.map((item) => calculateServiceDue(context, item)).filter((due): due is NonNullable<typeof due> => Boolean(due && due.remainingDays <= 30));
  const preventiveMaintenanceSavings = Math.round(upcomingServices.reduce((sum, due) => {
    const risk = ranking.find((item) => item.equipmentId === due.equipmentId);
    return sum + Math.max(0, (risk?.score ?? 35) * 180 - due.estimatedCost * 0.35);
  }, 0));
  const sparePartsOptimizationSavings = Math.round(forecastSparePartsFromContext(context).filter((part) => part.reorderRecommended).reduce((sum, part) => sum + part.leadTimeDays * 650 + part.reorderCost * 0.12, 0));
  const repairReplaceSavings = Math.max(0, Math.round((extras.repairReplaceAnalyses ?? []).reduce((sum, item) => sum + number(item.financialImpact?.projectedSavings, 0), 0)));
  const totalEstimatedSavings = estimatedDowntimeAvoided + warrantyRecoveryOpportunity + preventiveMaintenanceSavings + sparePartsOptimizationSavings + repairReplaceSavings;
  return { estimatedDowntimeAvoided, warrantyRecoveryOpportunity, preventiveMaintenanceSavings, sparePartsOptimizationSavings, repairReplaceSavings, totalEstimatedSavings };
}

function priorityRank(priority: string) {
  return ({ Critical: 0, High: 1, Medium: 2, Low: 3 } as Record<string, number>)[priority] ?? 9;
}

function buildMineCareRecommendations(context: Awaited<ReturnType<typeof loadMineCareContext>>, extras: Record<string, any[]> = {}) {
  const savings = calculateMineCareSavings(context, extras);
  const statusById = new Map((extras.recommendations ?? []).map((item) => [item.recommendationId, item.status]));
  const recommendations: any[] = [];
  const pushRecommendation = (item: any) => {
    const recommendationId = statusKey('rec', item.source, item.equipmentId ?? item.title, item.recommendationType);
    recommendations.push({
      recommendationId,
      status: statusById.get(recommendationId) ?? 'Open',
      confidence: 0.74,
      estimatedSavings: 0,
      ...item,
    });
  };

  calculateRiskRankingFromContext(context).filter((risk) => risk.priority === 'Critical' || risk.priority === 'High').slice(0, 6).forEach((risk) => {
    const equipment = context.equipment.find((item) => item.equipmentId === risk.equipmentId);
    pushRecommendation({
      equipmentId: risk.equipmentId,
      equipmentName: risk.equipmentName,
      recommendationType: 'Risk Reduction',
      title: `${risk.equipmentName} requires priority maintenance review`,
      reason: `${risk.equipmentName} is ${risk.priority.toLowerCase()} because ${risk.reasons.join(', ') || 'multiple risk signals are active'}.`,
      priority: risk.priority,
      recommendedAction: equipment?.type === 'Crusher' ? 'Inspect bearing, lubrication, and drive load within 48 hours.' : 'Review service history, observations, and spare readiness before next shift.',
      estimatedImpact: `Health score ${risk.healthScore}; risk score ${risk.score}.`,
      estimatedSavings: Math.round((100 - risk.healthScore) * 1100),
      source: 'Risk',
      confidence: 0.82,
    });
  });

  context.equipment.forEach((equipment) => {
    const due = calculateServiceDue(context, equipment);
    if (due && due.remainingDays <= 7) {
      pushRecommendation({
        equipmentId: equipment.equipmentId,
        equipmentName: equipment.name,
        recommendationType: 'Preventive Service',
        title: `${due.serviceName} is ${due.remainingDays <= 0 ? 'overdue' : 'due this week'}`,
        reason: `${equipment.name} has ${due.remainingHours} running hour(s) remaining before the next ${due.serviceName}.`,
        priority: due.remainingDays <= 0 ? 'Critical' : 'High',
        recommendedAction: `Schedule ${due.serviceName} and reserve ${due.requiredParts.join(', ') || 'required parts'}.`,
        estimatedImpact: `Avoid unplanned service delay on ${equipment.location}.`,
        estimatedSavings: Math.max(2500, Math.round(due.estimatedCost * 1.8)),
        source: 'Service',
        confidence: 0.79,
      });
    }

    const warranty = calculateWarrantyStatus(context, equipment);
    if (warranty.status === 'Expiring Soon') {
      pushRecommendation({
        equipmentId: equipment.equipmentId,
        equipmentName: equipment.name,
        recommendationType: 'Warranty Recovery',
        title: `${equipment.name} warranty is expiring soon`,
        reason: `${warranty.remainingDays} day(s) and ${warranty.remainingHours} hour(s) remain. Open defects should be reviewed before expiry.`,
        priority: 'Medium',
        recommendedAction: 'Audit open observations and breakdowns for covered warranty claim opportunities.',
        estimatedImpact: 'Protect recoverable warranty value before coverage expires.',
        estimatedSavings: Math.round((equipment.invoiceValue ?? 0) * 0.015),
        source: 'Warranty',
        confidence: 0.76,
      });
    }
  });

  warrantyClaimsFromContext(context).filter((claim) => claim.status !== 'Approved' && claim.status !== 'Rejected').forEach((claim) => {
    pushRecommendation({
      equipmentId: claim.equipmentId,
      equipmentName: claim.equipmentName,
      recommendationType: 'Warranty Claim',
      title: `Submit warranty claim for ${claim.failureType}`,
      reason: `${claim.failureType} may be recoverable under the active warranty terms.`,
      priority: claim.recoverableCost > 7000 ? 'High' : 'Medium',
      recommendedAction: claim.recommendation,
      estimatedImpact: `Recoverable cost opportunity ${claim.recoverableCost}.`,
      estimatedSavings: claim.recoverableCost,
      source: 'Warranty',
      confidence: 0.78,
    });
  });

  forecastSparePartsFromContext(context).filter((part) => part.reorderRecommended).forEach((part) => {
    pushRecommendation({
      recommendationType: 'Spare Readiness',
      title: `Reorder ${part.partName}`,
      reason: `${part.partName} projected stock is ${part.projectedStock}; minimum stock is ${part.minimumStock}.`,
      priority: part.currentStock === 0 ? 'High' : 'Medium',
      recommendedAction: `Order ${part.reorderQuantity} unit(s) before the ${part.leadTimeDays}-day lead time blocks maintenance.`,
      estimatedImpact: 'Prevents service delay and production downtime exposure.',
      estimatedSavings: Math.round(part.leadTimeDays * 650),
      source: 'Spare',
      confidence: 0.74,
    });
  });

  (extras.rootCauses ?? []).slice(0, 4).forEach((analysis) => {
    pushRecommendation({
      equipmentId: analysis.equipmentId,
      equipmentName: analysis.equipmentName,
      recommendationType: 'Root Cause Follow-up',
      title: `Act on RCA for ${analysis.failureType}`,
      reason: analysis.likelyRootCauses?.[0] || analysis.problem,
      priority: analysis.failureType?.toLowerCase().includes('bearing') ? 'High' : 'Medium',
      recommendedAction: analysis.recommendedActions?.[0] || 'Review root cause evidence and assign corrective action.',
      estimatedImpact: 'Reduces repeat failure risk.',
      estimatedSavings: 6800,
      source: 'Root Cause',
      confidence: number(analysis.confidence, 0.72),
    });
  });

  (extras.vendorSlas ?? []).filter((sla) => sla.status === 'At Risk' || sla.status === 'Breached' || number(sla.missedServiceCount, 0) > 0).forEach((sla) => {
    pushRecommendation({
      equipmentId: sla.equipmentIds?.[0],
      equipmentName: sla.equipmentIds?.join(', '),
      recommendationType: 'Vendor SLA',
      title: `${sla.vendorName} SLA needs escalation`,
      reason: `${sla.vendorName} compliance is ${sla.slaCompliancePercent}% with penalty exposure ${sla.penaltyAmount}.`,
      priority: sla.status === 'Breached' ? 'High' : 'Medium',
      recommendedAction: 'Escalate vendor service miss and recover penalty or priority support.',
      estimatedImpact: 'Improves AMC compliance and protects service response time.',
      estimatedSavings: number(sla.penaltyAmount, 0),
      source: 'Vendor',
      confidence: 0.72,
    });
  });

  (extras.repairReplaceAnalyses ?? []).filter((item) => number(item.financialImpact?.projectedSavings, 0) > 0).slice(0, 4).forEach((item) => {
    pushRecommendation({
      equipmentId: item.equipmentId,
      equipmentName: item.equipmentName,
      recommendationType: 'Repair Replace',
      title: `${item.recommendation} recommendation for ${item.equipmentName}`,
      reason: item.reason,
      priority: item.recommendation === 'Replace' ? 'High' : 'Medium',
      recommendedAction: item.recommendedActions?.[0] || 'Review repair/replace financial impact.',
      estimatedImpact: `Projected savings ${number(item.financialImpact?.projectedSavings, 0)}.`,
      estimatedSavings: Math.max(0, number(item.financialImpact?.projectedSavings, 0)),
      source: 'Budget',
      confidence: number(item.confidence, 0.7),
    });
  });

  if (savings.totalEstimatedSavings > 0) {
    pushRecommendation({
      recommendationType: 'Cost Savings',
      title: 'Prioritize AI savings plan',
      reason: `MineCare AI identified total estimated savings of ${savings.totalEstimatedSavings}.`,
      priority: savings.totalEstimatedSavings > 100000 ? 'High' : 'Medium',
      recommendedAction: 'Review critical risk, warranty recovery, and spare readiness recommendations in the next planning meeting.',
      estimatedImpact: 'Combines downtime avoidance, warranty recovery, preventive savings, spare optimization, and repair/replace savings.',
      estimatedSavings: savings.totalEstimatedSavings,
      source: 'AI',
      confidence: 0.81,
    });
  }

  return recommendations.sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || right.estimatedSavings - left.estimatedSavings);
}

function mineCareReportWindowDays(period: MineCareReportPeriod) {
  return period === 'monthly' ? 30 : 7;
}

function reportFromContext(context: Awaited<ReturnType<typeof loadMineCareContext>>, period: MineCareReportPeriod, extras: Record<string, any[]> = {}) {
  const windowDays = mineCareReportWindowDays(period);
  const ranking = calculateRiskRankingFromContext(context);
  const alerts = alertsFromContext(context);
  const budget = budgetFromContext(context);
  const parts = forecastSparePartsFromContext(context).filter((part) => part.reorderRecommended);
  const serviceCalendar = serviceCalendarFromContext(context);
  const upcomingServices = [
    ...serviceCalendar.overdueServices,
    ...serviceCalendar.upcomingServices.filter((service) => service.remainingDays <= windowDays),
  ].sort((left, right) => left.remainingDays - right.remainingDays);
  const warrantyClaimOpportunities = warrantyClaimsFromContext(context);
  const savings = calculateMineCareSavings(context, extras);
  const recommendations = buildMineCareRecommendations(context, extras).slice(0, 8);
  const maintenanceHistoryHighlights = [...context.maintenanceHistory].sort((left, right) => right.serviceDate.getTime() - left.serviceDate.getTime()).slice(0, 12);
  const breakdownHighlights = [...context.breakdowns].sort((left, right) => right.breakdownDate.getTime() - left.breakdownDate.getTime()).slice(0, 12);
  const operatorObservationHighlights = [...context.observations].sort((left, right) => {
    const severityDelta = priorityRank(right.severity) - priorityRank(left.severity);
    return severityDelta || right.observationDate.getTime() - left.observationDate.getTime();
  }).slice(0, 12);
  return {
    period,
    windowDays,
    generatedAt: now(),
    summary: { totalEquipment: context.equipment.length, criticalAssets: ranking.filter((risk) => risk.priority === 'Critical').length, upcomingServices: upcomingServices.length, serviceAlerts: upcomingServices.length, warrantyAlerts: alerts.filter((alert) => alert.type === 'Warranty Alert').length, warrantyClaimOpportunities: warrantyClaimOpportunities.length, sparePartRequirements: parts.length, estimatedCostExposure: budget.costExposure, potentialSavings: budget.potentialSavings, totalEstimatedSavings: savings.totalEstimatedSavings },
    criticalAssets: ranking.slice(0, 5),
    upcomingServices,
    warrantyAlerts: alerts.filter((alert) => alert.type === 'Warranty Alert'),
    warrantyClaimOpportunities,
    sparePartRequirements: parts,
    budgetForecast: budget,
    rootCauseHighlights: (extras.rootCauses ?? []).slice(0, 5),
    repairReplaceHighlights: (extras.repairReplaceAnalyses ?? []).slice(0, 5),
    procurementInsights: (extras.procurementComparisons ?? []).slice(0, 3),
    maintenanceHistoryHighlights,
    breakdownHighlights,
    operatorObservationHighlights,
    aiRecommendations: recommendations,
    savings,
    recommendedActions: actionCenterFromContext(context),
  };
}

function formatMineCarePdfCurrency(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(number(value, 0));
}

function formatMineCarePdfDate(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatMineCarePdfValue(value: unknown) {
  if (typeof value === 'number') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  if (value instanceof Date) return formatMineCarePdfDate(value);
  return text(value, '-');
}

function sanitizeMineCarePdfText(value: unknown) {
  return String(value ?? '-')
    .normalize('NFKD')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || '-';
}

function oneLine(value: unknown) {
  return sanitizeMineCarePdfText(value);
}

function joinMineCarePdfList(value: unknown, fallback = '-') {
  const list = cleanStringArray(value);
  return list.length ? list.join(', ') : fallback;
}

function wrapMineCarePdfText(rawText: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = sanitizeMineCarePdfText(rawText).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (font.widthOfTextAtSize(next, fontSize) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines;
}

async function buildMineCareExecutiveReportPdf(report: Record<string, any>) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 44;
  const bottom = 56;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  const drawText = (
    value: string,
    options: { size?: number; bold?: boolean; indent?: number; color?: ReturnType<typeof rgb>; gapAfter?: number; minY?: number } = {}
  ) => {
    const safeValue = sanitizeMineCarePdfText(value);
    const size = options.size ?? 10;
    const font = options.bold ? boldFont : regularFont;
    const indent = options.indent ?? 0;
    const lineHeight = Math.max(12, size + 4);
    const maxWidth = pageSize[0] - margin * 2 - indent;
    const lines = wrapMineCarePdfText(safeValue, font, size, maxWidth);
    for (const line of lines) {
      if (y < (options.minY ?? bottom)) addPage();
      page.drawText(line, {
        x: margin + indent,
        y,
        size,
        font,
        color: options.color ?? rgb(0.13, 0.16, 0.22),
      });
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 2;
  };

  const section = (title: string) => {
    if (y < 110) addPage();
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 0.8, color: rgb(0.80, 0.84, 0.88) });
    y -= 20;
    drawText(title, { size: 13, bold: true, color: rgb(0.04, 0.23, 0.33), gapAfter: 6 });
  };

  const bullet = (value: string) => drawText(`- ${value}`, { indent: 12 });
  const empty = (value = 'No records found for this report window.') => drawText(value, { indent: 12, color: rgb(0.42, 0.47, 0.55) });

  drawText('MineCare AI Executive Maintenance Report', { size: 20, bold: true, color: rgb(0.02, 0.18, 0.27), gapAfter: 6 });
  drawText(`Frequency: ${oneLine(report.period).toUpperCase()} (${number(report.windowDays, 7)} day planning window)`, { size: 11, bold: true });
  drawText(`Generated: ${formatMineCarePdfDate(report.generatedAt)}`, { size: 10, color: rgb(0.36, 0.41, 0.48), gapAfter: 10 });

  section('Executive Summary');
  const summary = report.summary ?? {};
  [
    `Total equipment: ${formatMineCarePdfValue(summary.totalEquipment)}`,
    `Critical assets: ${formatMineCarePdfValue(summary.criticalAssets)}`,
    `Upcoming services in window: ${formatMineCarePdfValue(summary.upcomingServices)}`,
    `Service alerts: ${formatMineCarePdfValue(summary.serviceAlerts)}`,
    `Warranty alerts: ${formatMineCarePdfValue(summary.warrantyAlerts)}`,
    `Warranty claim opportunities: ${formatMineCarePdfValue(summary.warrantyClaimOpportunities)}`,
    `Spare part shortages/reorders: ${formatMineCarePdfValue(summary.sparePartRequirements)}`,
    `Estimated cost exposure: ${formatMineCarePdfCurrency(summary.estimatedCostExposure)}`,
    `Potential savings: ${formatMineCarePdfCurrency(summary.potentialSavings ?? summary.totalEstimatedSavings)}`,
  ].forEach(bullet);

  section('Top Risk Assets');
  const criticalAssets = Array.isArray(report.criticalAssets) ? report.criticalAssets : [];
  criticalAssets.length ? criticalAssets.forEach((item: any) => {
    bullet(`${oneLine(item.equipmentName)} (${oneLine(item.equipmentId)}) - ${oneLine(item.priority)} risk, score ${formatMineCarePdfValue(item.score)}, health ${formatMineCarePdfValue(item.healthScore)}. Reasons: ${joinMineCarePdfList(item.reasons)}. Next action: ${oneLine(item.nextBestAction)}`);
  }) : empty('No critical or high-risk assets were identified.');

  section('Upcoming And Overdue Services');
  const upcomingServices = Array.isArray(report.upcomingServices) ? report.upcomingServices : [];
  upcomingServices.length ? upcomingServices.forEach((item: any) => {
    bullet(`${oneLine(item.equipmentName)} (${oneLine(item.equipmentId)}) - ${oneLine(item.serviceName)} is ${number(item.remainingDays, 0) <= 0 ? 'overdue' : `due in ${formatMineCarePdfValue(item.remainingDays)} day(s)`}; due date ${formatMineCarePdfDate(item.serviceDueDate)}; estimated cost ${formatMineCarePdfCurrency(item.estimatedCost)}; required parts: ${joinMineCarePdfList(item.requiredParts)}; action: ${oneLine(item.aiRecommendedAction)}`);
  }) : empty();

  section('Warranty Alerts And Claim Opportunities');
  const warrantyAlerts = Array.isArray(report.warrantyAlerts) ? report.warrantyAlerts : [];
  const warrantyClaimOpportunities = Array.isArray(report.warrantyClaimOpportunities) ? report.warrantyClaimOpportunities : [];
  warrantyAlerts.length ? warrantyAlerts.forEach((item: any) => {
    bullet(`${oneLine(item.equipmentName)} (${oneLine(item.equipmentId)}) - ${oneLine(item.severity)} ${oneLine(item.type)}: ${oneLine(item.message)}. Status: ${oneLine(item.status)}.`);
  }) : empty('No warranty alerts found.');
  warrantyClaimOpportunities.length ? warrantyClaimOpportunities.forEach((item: any) => {
    bullet(`Claim: ${oneLine(item.equipmentName)} (${oneLine(item.equipmentId)}) - ${oneLine(item.failureType)} on ${formatMineCarePdfDate(item.breakdownDate)}; recoverable ${formatMineCarePdfCurrency(item.recoverableCost)}; probability ${formatMineCarePdfValue(number(item.claimProbability, 0) * 100)}%; missing documents: ${joinMineCarePdfList(item.missingDocuments, 'None')}; recommendation: ${oneLine(item.recommendation)}`);
  }) : empty('No warranty claim opportunities found.');

  section('Spare Parts Readiness');
  const sparePartRequirements = Array.isArray(report.sparePartRequirements) ? report.sparePartRequirements : [];
  sparePartRequirements.length ? sparePartRequirements.forEach((item: any) => {
    bullet(`${oneLine(item.partName)} (${oneLine(item.partNumber)}) - stock ${formatMineCarePdfValue(item.currentStock)}, min ${formatMineCarePdfValue(item.minimumStock)}, reorder ${formatMineCarePdfValue(item.reorderQuantity)}, reorder cost ${formatMineCarePdfCurrency(item.reorderCost)}. Risk: ${oneLine(item.shortageRisk)}. Strategy: ${oneLine(item.stockingStrategy ?? item.aiRecommendation)}`);
  }) : empty('No spare part shortages found.');

  section('Budget And Savings');
  const budget = report.budgetForecast ?? {};
  const savings = report.savings ?? {};
  [
    `Month: ${oneLine(budget.month)}`,
    `Monthly maintenance budget: ${formatMineCarePdfCurrency(budget.monthlyMaintenanceBudget)}`,
    `Service cost forecast: ${formatMineCarePdfCurrency(budget.serviceCost)}`,
    `Risk buffer: ${formatMineCarePdfCurrency(budget.riskBuffer)}`,
    `Cost exposure: ${formatMineCarePdfCurrency(budget.costExposure)}`,
    `Potential savings: ${formatMineCarePdfCurrency(budget.potentialSavings)}`,
    `AI total estimated savings: ${formatMineCarePdfCurrency(savings.totalEstimatedSavings)}`,
    `Downtime avoided: ${formatMineCarePdfCurrency(savings.estimatedDowntimeAvoided)}`,
    `Warranty recovery opportunity: ${formatMineCarePdfCurrency(savings.warrantyRecoveryOpportunity)}`,
    `Preventive maintenance savings: ${formatMineCarePdfCurrency(savings.preventiveMaintenanceSavings)}`,
    `Repair/replace savings: ${formatMineCarePdfCurrency(savings.repairReplaceSavings)}`,
  ].forEach(bullet);

  section('Maintenance, Breakdowns, And Operator Observations');
  const maintenanceHistoryHighlights = Array.isArray(report.maintenanceHistoryHighlights) ? report.maintenanceHistoryHighlights : [];
  const breakdownHighlights = Array.isArray(report.breakdownHighlights) ? report.breakdownHighlights : [];
  const operatorObservationHighlights = Array.isArray(report.operatorObservationHighlights) ? report.operatorObservationHighlights : [];
  maintenanceHistoryHighlights.length ? maintenanceHistoryHighlights.forEach((item: any) => {
    bullet(`Maintenance - ${oneLine(item.equipmentId)} on ${formatMineCarePdfDate(item.serviceDate)}: ${oneLine(item.serviceName)}; action ${oneLine(item.actionTaken)}; technician ${oneLine(item.technician)}; cost ${formatMineCarePdfCurrency(item.cost)}; downtime ${formatMineCarePdfValue(item.downtimeHours)} hour(s).`);
  }) : empty('No maintenance history records found.');
  breakdownHighlights.length ? breakdownHighlights.forEach((item: any) => {
    bullet(`Breakdown - ${oneLine(item.equipmentId)} on ${formatMineCarePdfDate(item.breakdownDate)}: ${oneLine(item.failureType)} / ${oneLine(item.component)}; root cause ${oneLine(item.rootCause)}; repair cost ${formatMineCarePdfCurrency(item.repairCost)}; downtime ${formatMineCarePdfValue(item.downtimeHours)} hour(s); warranty claim ${item.warrantyClaimRaised ? 'raised' : 'not raised'}.`);
  }) : empty('No breakdown records found.');
  operatorObservationHighlights.length ? operatorObservationHighlights.forEach((item: any) => {
    bullet(`Observation - ${oneLine(item.equipmentId)} on ${formatMineCarePdfDate(item.observationDate)}: ${oneLine(item.severity)} ${oneLine(item.observationType)}; ${oneLine(item.description)}.`);
  }) : empty('No operator observations found.');

  section('AI Analysis Highlights');
  const rootCauseHighlights = Array.isArray(report.rootCauseHighlights) ? report.rootCauseHighlights : [];
  const repairReplaceHighlights = Array.isArray(report.repairReplaceHighlights) ? report.repairReplaceHighlights : [];
  const procurementInsights = Array.isArray(report.procurementInsights) ? report.procurementInsights : [];
  rootCauseHighlights.length ? rootCauseHighlights.forEach((item: any) => {
    bullet(`Root cause - ${oneLine(item.equipmentName)}: ${oneLine(item.problem)}. Likely causes: ${joinMineCarePdfList(item.likelyRootCauses)}. Actions: ${joinMineCarePdfList(item.recommendedActions)}.`);
  }) : empty('No root cause highlights found.');
  repairReplaceHighlights.length ? repairReplaceHighlights.forEach((item: any) => {
    bullet(`Repair/replace - ${oneLine(item.equipmentName)}: ${oneLine(item.recommendation)}. Reason: ${oneLine(item.reason)}. Payback: ${oneLine(item.paybackEstimate)}.`);
  }) : empty('No repair/replace highlights found.');
  procurementInsights.length ? procurementInsights.forEach((item: any) => {
    bullet(`Procurement/TCO - Best option: ${oneLine(item.bestOption)}. Reason: ${oneLine(item.reason)}. Vendor risk: ${oneLine(item.vendorRiskSummary)}.`);
  }) : empty('No procurement insights found.');

  section('AI Recommendations');
  const aiRecommendations = Array.isArray(report.aiRecommendations) ? report.aiRecommendations : [];
  aiRecommendations.length ? aiRecommendations.forEach((item: any) => {
    bullet(`${oneLine(item.priority)} - ${oneLine(item.title)}. Reason: ${oneLine(item.reason)}. Recommended action: ${oneLine(item.recommendedAction)}. Estimated impact: ${oneLine(item.estimatedImpact)}. Estimated savings: ${formatMineCarePdfCurrency(item.estimatedSavings)}. Confidence: ${formatMineCarePdfValue(number(item.confidence, 0) * 100)}%.`);
  }) : empty('No AI recommendations available.');

  section('Recommended Action Plan');
  const recommendedActions = Array.isArray(report.recommendedActions) ? report.recommendedActions : [];
  recommendedActions.length ? recommendedActions.forEach((item: any) => {
    bullet(`${oneLine(item.priority)} - ${oneLine(item.equipmentName ?? item.equipment)}: ${oneLine(item.action)}. Source: ${oneLine(item.source)}. Due: ${formatMineCarePdfDate(item.dueDate)}. Status: ${oneLine(item.status)}.`);
  }) : empty('No recommended actions found.');

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(sanitizeMineCarePdfText(`MineCare AI | ${oneLine(report.period)} report | Page ${index + 1} of ${pages.length}`), {
      x: margin,
      y: 28,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.55),
    });
  });

  return Buffer.from(await pdf.save());
}

async function loadMineCarePhase2Context() {
  await seedMineCarePhase2SampleData();
  const context = await loadMineCareContext();
  const [rootCauses, checklists, knowledgeDocuments, vendorSlas, repairReplaceAnalyses, downtimeScenarios, technicians, procurementOptions, procurementComparisons, recommendations] = await Promise.all([
    MineCareRootCauseAnalysis.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareChecklist.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareKnowledgeDocument.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareVendorSla.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareRepairReplaceAnalysis.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareDowntimeScenario.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareTechnician.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareProcurementOption.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareProcurementComparison.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
    MineCareRecommendation.find({ isDeleted: false }).sort({ updated: -1 }).lean(),
  ]);
  return { ...context, rootCauses, checklists, knowledgeDocuments, vendorSlas, repairReplaceAnalyses, downtimeScenarios, technicians, procurementOptions, procurementComparisons, recommendations };
}

function idFilter(field: string, identifier: string) {
  const filters: Array<Record<string, unknown>> = [{ [field]: identifier }];
  if (Types.ObjectId.isValid(identifier)) filters.push({ _id: new Types.ObjectId(identifier) });
  return { $or: filters, isDeleted: false };
}

function generatedId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function tokenize(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length > 2);
}

function knowledgeChunksFromText(documentId: string, documentName: string, rawText: string, meta: Record<string, unknown>) {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  const chunks: Array<Record<string, unknown>> = [];
  for (let index = 0; index < normalized.length; index += 900) {
    const chunkText = normalized.slice(index, index + 1200).trim();
    if (!chunkText) continue;
    chunks.push({
      chunkId: `${documentId}-CH-${chunks.length + 1}`,
      documentId,
      documentName,
      section: `Section ${chunks.length + 1}`,
      chunkIndex: chunks.length,
      text: chunkText,
      keywords: Array.from(new Set(tokenize(chunkText))).slice(0, 20),
      equipmentId: text(meta.equipmentId),
      equipmentType: text(meta.equipmentType),
      active: true,
      isDeleted: false,
      created: now(),
      updated: now(),
    });
  }
  return chunks;
}

function mentionedEquipmentIds(question: string, equipment: any[]) {
  const lower = question.toLowerCase();
  return equipment
    .filter((item) => {
      const equipmentId = text(item.equipmentId).toLowerCase();
      const name = text(item.name).toLowerCase();
      const serialNumber = text(item.serialNumber).toLowerCase();
      return Boolean(
        (equipmentId && lower.includes(equipmentId)) ||
        (name && lower.includes(name)) ||
        (serialNumber && lower.includes(serialNumber))
      );
    })
    .map((item) => item.equipmentId);
}

function scoreKnowledgeChunks(question: string, chunks: any[], preferredEquipmentIds: string[] = [], limit = 5) {
  const tokens = tokenize(question);
  if (!tokens.length) return [];
  const preferredIds = new Set(preferredEquipmentIds);
  const scopedChunks = preferredIds.size ? chunks.filter((chunk) => preferredIds.has(text(chunk.equipmentId))) : chunks;
  return scopedChunks
    .map((chunk: any) => {
      const chunkText = text(chunk.text).toLowerCase();
      const chunkKeywords = Array.isArray(chunk.keywords) ? chunk.keywords : [];
      const assetBoost = preferredIds.has(text(chunk.equipmentId)) ? 6 : 0;
      return {
        chunk,
        score: assetBoost + tokens.reduce((sum, token) => sum + (chunkText.includes(token) ? 2 : 0) + (chunkKeywords.includes(token) ? 1 : 0) + (String(chunk.equipmentId ?? '').toLowerCase().includes(token) ? 3 : 0), 0),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

async function relevantKnowledgeSnippets(question: string, context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const preferredEquipmentIds = mentionedEquipmentIds(question, context.equipment);
  const documentFilter: any = { isDeleted: false, status: 'Ready' };
  if (preferredEquipmentIds.length) documentFilter.equipmentId = { $in: preferredEquipmentIds };
  const readyDocumentIds = await MineCareKnowledgeDocument.find(documentFilter).distinct('documentId');
  if (!readyDocumentIds.length) return [];
  const chunks = await MineCareKnowledgeChunk.find({ isDeleted: false, documentId: { $in: readyDocumentIds }, ...(preferredEquipmentIds.length ? { equipmentId: { $in: preferredEquipmentIds } } : {}) }).lean();
  return scoreKnowledgeChunks(question, chunks, preferredEquipmentIds, 6)
    .map((item) => ({
      documentId: item.chunk.documentId,
      documentName: item.chunk.documentName,
      equipmentId: item.chunk.equipmentId,
      equipmentType: item.chunk.equipmentType,
      section: item.chunk.section,
      chunkIndex: item.chunk.chunkIndex,
      snippet: item.chunk.text.slice(0, 500),
      confidence: Math.min(0.9, 0.5 + item.score * 0.04),
    }));
}

function deterministicRootCause(payload: Record<string, unknown>, context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const equipmentId = text(payload.equipmentId);
  const equipment = equipmentId ? findEquipment(context, equipmentId) : null;
  const failureType = text(payload.failureType, 'Equipment Failure');
  const component = text(payload.component);
  const relatedBreakdowns = context.breakdowns.filter((item) => item.equipmentId === equipmentId || item.failureType.toLowerCase().includes(failureType.toLowerCase()) || (component && (item.component ?? '').toLowerCase().includes(component.toLowerCase())));
  const observations = context.observations.filter((item) => item.equipmentId === equipmentId);
  const causes = Array.from(new Set([
    ...relatedBreakdowns.map((item) => item.rootCause),
    observations.some((item) => item.observationType === 'Heating') ? 'Thermal stress or lubrication gap' : '',
    observations.some((item) => item.observationType === 'Vibration') ? 'Alignment issue or bearing wear' : '',
    component ? `${component} wear under operating load` : 'Delayed preventive maintenance',
  ].filter(Boolean))).slice(0, 5);
  return {
    equipmentId,
    equipmentName: equipment?.name ?? text(payload.equipmentName, equipmentId),
    failureType,
    component,
    problem: text(payload.problem, `${failureType} reported for ${equipment?.name ?? equipmentId}.`),
    likelyRootCauses: causes.length ? causes : ['Inspection data is limited; start with service history, lubrication, and operating load checks.'],
    evidence: [
      ...relatedBreakdowns.slice(0, 3).map((item) => `${item.failureType} on ${item.breakdownDate.toISOString().slice(0, 10)} caused ${item.downtimeHours} downtime hour(s).`),
      ...observations.slice(0, 3).map((item) => `${item.severity} operator observation: ${item.description}`),
    ],
    recommendedActions: ['Inspect affected component before next shift.', 'Review last preventive service checklist.', 'Confirm spare availability and warranty coverage before repair approval.'],
    causeConfidence: (causes.length ? causes : ['Inspection data is limited; start with service history, lubrication, and operating load checks.']).map((cause, index) => ({ cause, confidence: Math.max(0.45, 0.82 - index * 0.08) })),
    preventiveControls: ['Add inspection point to next checklist.', 'Trend operator observations for repeat symptoms.', 'Confirm critical spare availability before production dispatch.'],
    evidenceSummary: relatedBreakdowns.length || observations.length
      ? `${relatedBreakdowns.length} related breakdown(s) and ${observations.length} operator observation(s) support the RCA draft.`
      : 'Limited historical evidence was found; RCA should be validated through field inspection.',
    confidence: relatedBreakdowns.length || observations.length ? 0.78 : 0.56,
  };
}

function deterministicChecklist(payload: Record<string, unknown>, context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const equipment = findEquipment(context, text(payload.equipmentId)) ?? context.equipment[0];
  const schedule = equipment ? findSchedule(context, equipment) : null;
  const serviceType = text(payload.serviceType, schedule?.serviceName ?? 'Preventive Maintenance');
  const requiredParts = cleanStringArray(payload.requiredParts).length ? cleanStringArray(payload.requiredParts) : (schedule?.requiredParts ?? []);
  const tasks = [
    'Lock out equipment and confirm zero energy state.',
    `Inspect ${serviceType.toLowerCase()} points and record readings.`,
    requiredParts.length ? `Verify availability of ${requiredParts.join(', ')}.` : 'Verify spare parts and consumables before work starts.',
    'Complete service, clean work area, and update maintenance record.',
  ];
  return {
    equipmentId: equipment?.equipmentId ?? text(payload.equipmentId),
    equipmentName: equipment?.name ?? text(payload.equipmentName),
    serviceType,
    checklistTitle: text(payload.checklistTitle, `${equipment?.name ?? 'Equipment'} ${serviceType} Checklist`),
    items: tasks.map((task, index) => ({
      itemId: `TMP-${index + 1}`,
      step: index + 1,
      task,
      safetyNote: index === 0 ? 'Follow site lockout/tagout procedure.' : 'Use required PPE and supervisor sign-off.',
      requiredPart: index === 2 ? requiredParts[0] ?? '' : '',
      estimatedTimeMinutes: index === 0 ? 15 : 30,
      completed: false,
    })),
    safetyPrecautions: ['Lockout/tagout', 'PPE', 'Barricade work area'],
    requiredTools: ['Inspection torch', 'Thermal camera', 'Torque wrench'],
    requiredParts,
    skillRequirement: equipment?.criticality === 'Critical' ? 'Senior technician with supervisor sign-off' : 'Qualified maintenance technician',
    qualityGate: 'Supervisor must verify readings, replaced parts, and post-service test before release.',
    aiPreparationNotes: [
      requiredParts.length ? `Pre-stage ${requiredParts.join(', ')} before work starts.` : 'Confirm consumables and spare availability before dispatch.',
      'Attach completed checklist to the maintenance record.',
    ],
    confidence: 0.74,
  };
}

function deterministicRepairReplace(payload: Record<string, unknown>, context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const equipment = findEquipment(context, text(payload.equipmentId)) ?? context.equipment[0];
  const breakdowns = context.breakdowns.filter((item) => item.equipmentId === equipment?.equipmentId);
  const repairOptionCost = number(payload.repairCost, breakdowns.reduce((sum, item) => sum + item.repairCost, 0) || (equipment?.invoiceValue ?? 0) * 0.18);
  const replacementOptionCost = number(payload.replacementCost, (equipment?.invoiceValue ?? 0) * 1.1);
  const downtimeRisk = breakdowns.reduce((sum, item) => sum + item.downtimeHours, 0) * 2500;
  const repairCostRatio = replacementOptionCost ? repairOptionCost / replacementOptionCost : 0;
  const health = equipment ? calculateHealthScore(context, equipment) : { score: 70 };
  const recommendation = repairCostRatio > 0.45 || health.score < 45 ? 'Replace' : repairCostRatio > 0.3 ? 'Review' : 'Repair';
  return {
    equipmentId: equipment?.equipmentId ?? text(payload.equipmentId),
    equipmentName: equipment?.name ?? text(payload.equipmentName),
    recommendation,
    reason: recommendation === 'Replace' ? 'Repair exposure and health risk are high against replacement value.' : 'Repair remains financially reasonable based on current cost ratio and health score.',
    repairCostRatio: Math.round(repairCostRatio * 100) / 100,
    estimatedReplacementYear: now().getFullYear() + (recommendation === 'Replace' ? 1 : 3),
    financialImpact: {
      repairOptionCost: Math.round(repairOptionCost),
      replacementOptionCost: Math.round(replacementOptionCost),
      downtimeRisk: Math.round(downtimeRisk),
      projectedSavings: Math.round(replacementOptionCost - repairOptionCost - downtimeRisk),
    },
    recommendedActions: ['Validate latest repair quote.', 'Compare warranty and downtime exposure.', 'Review procurement lead time before approval.'],
    decisionFactors: [
      `Repair cost ratio ${Math.round(repairCostRatio * 100)}% of replacement cost.`,
      `Health score ${health.score}.`,
      `${breakdowns.length} breakdown record(s) considered.`,
      `Downtime risk ${Math.round(downtimeRisk)}.`,
    ],
    paybackEstimate: projectedPaybackText(replacementOptionCost, repairOptionCost, downtimeRisk),
    confidence: 0.72,
  };
}

function projectedPaybackText(replacementCost: number, repairCost: number, downtimeRisk: number) {
  const avoidedExposure = Math.max(1, repairCost + downtimeRisk);
  const years = Math.max(1, Math.round((replacementCost / avoidedExposure) * 10) / 10);
  return `${years} year(s) estimated payback against repair and downtime exposure.`;
}

function deterministicProcurementComparison(options: any[]) {
  const comparison = options.map((item) => ({
    optionId: item.optionId,
    name: item.name,
    fiveYearTco: Math.round(item.purchaseCost + item.expectedMaintenanceCost * 5 + item.fuelCost * 5 + item.downtimeRiskCost - item.resaleValue),
  })).sort((left, right) => left.fiveYearTco - right.fiveYearTco);
  const best = comparison[0];
  return {
    bestOption: best?.optionId ?? '',
    reason: best ? `${best.name} has the lowest estimated five-year total cost of ownership.` : 'No comparable procurement options were available.',
    comparison,
    recommendedActions: ['Confirm vendor delivery date.', 'Review warranty coverage and SLA terms.', 'Validate expected utilization before purchase approval.'],
    vendorRiskSummary: best ? `${best.name} is preferred on TCO; verify vendor response SLA and parts availability before award.` : 'Vendor risk cannot be assessed without procurement options.',
    negotiationPoints: ['Request extended warranty on high-wear components.', 'Confirm spares availability and service response SLA.', 'Negotiate downtime penalty or priority support clause.'],
    decisionFactors: comparison.slice(0, 3).map((item) => `${item.name}: five-year TCO ${item.fiveYearTco}`),
    confidence: best ? 0.76 : 0.4,
  };
}

function withChecklistProgress(item: any) {
  const totalItems = Array.isArray(item.items) ? item.items.length : 0;
  const completedItems = Array.isArray(item.items) ? item.items.filter((task: any) => task.completed).length : 0;
  const progressPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const checklistStatus = progressPercent === 100 ? 'Completed' : item.status === 'Draft' ? 'Draft' : 'Active';
  return { ...item, completedItems, totalItems, progressPercent, checklistStatus, status: checklistStatus };
}

function enrichExtractionSummary(payload: any) {
  const equipment = payload.equipment ?? {};
  const warranty = payload.warranty ?? {};
  const serviceSchedules = Array.isArray(payload.serviceSchedules) ? payload.serviceSchedules : [];
  const missingFields = cleanStringArray(payload.missingFields);
  const knownFields = Object.values(equipment).filter((value) => value !== '' && value !== 0 && value !== null && value !== undefined).length;
  const equipmentName = text(equipment.name) || text(equipment.equipmentId) || 'the uploaded asset';
  const equipmentType = text(equipment.type, 'equipment');
  const warrantyEnd = text(warranty.endDate);
  const firstSchedule = serviceSchedules[0] ?? {};
  return {
    ...payload,
    onboardingSummary: text(payload.onboardingSummary, `MineCare AI extracted ${knownFields} asset fields for ${equipmentName}. Review missing fields and warranty terms before creating the asset.`),
    warrantyInsight: text(payload.warrantyInsight, warrantyEnd ? `Warranty end date detected as ${warrantyEnd}. Validate covered components before approving major repairs.` : 'Warranty period was not confidently detected; confirm warranty start, end, and covered components.'),
    recommendedFirstService: text(payload.recommendedFirstService, text(firstSchedule.serviceName) ? `${text(firstSchedule.serviceName)} at ${number(firstSchedule.intervalHours, 500)} running hours.` : `Schedule first ${equipmentType} OEM inspection within 500 running hours.`),
    suggestedSpareKit: cleanStringArray(payload.suggestedSpareKit).length ? cleanStringArray(payload.suggestedSpareKit) : cleanStringArray(firstSchedule.requiredParts).slice(0, 5),
    suggestedCriticality: text(payload.suggestedCriticality, equipmentType.toLowerCase().includes('crusher') || equipmentType.toLowerCase().includes('pump') ? 'Critical' : text(equipment.criticality, 'Medium')),
    extractedFieldsCount: number(payload.extractedFieldsCount, knownFields),
    fieldConfidenceMap: payload.fieldConfidenceMap && typeof payload.fieldConfidenceMap === 'object' ? payload.fieldConfidenceMap : {},
    missingFields,
  };
}

async function syncRecommendations(context: Awaited<ReturnType<typeof loadMineCarePhase2Context>>) {
  const generated = buildMineCareRecommendations(context, {
    recommendations: context.recommendations,
    rootCauses: context.rootCauses,
    checklists: context.checklists,
    vendorSlas: context.vendorSlas,
    repairReplaceAnalyses: context.repairReplaceAnalyses,
    downtimeScenarios: context.downtimeScenarios,
    procurementComparisons: context.procurementComparisons,
  });
  if (generated.length) {
    await MineCareRecommendation.bulkWrite(generated.map((item) => ({
      updateOne: {
        filter: { recommendationId: item.recommendationId, isDeleted: false },
        update: { $setOnInsert: { ...item, active: true, isDeleted: false, created: now() }, $set: { updated: now() } },
        upsert: true,
      },
    })));
  }
  return MineCareRecommendation.find({ isDeleted: false }).sort({ priority: 1, estimatedSavings: -1, updated: -1 }).lean();
}

async function upsertWarranty(equipmentId: string, purchaseDate: Date, payload?: Record<string, unknown>) {
  if (!payload) return;
  await MineCareWarranty.findOneAndUpdate(
    { equipmentId, isDeleted: false },
    { equipmentId, startDate: dateFrom(payload.startDate, purchaseDate), endDate: dateFrom(payload.endDate, addDays(365)), hourLimit: number(payload.hourLimit, 3000), coveredComponents: cleanStringArray(payload.coveredComponents), terms: text(payload.terms, 'Standard warranty terms.'), active: true, isDeleted: false, updated: now() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertServiceSchedules(equipmentId: string, equipmentType: string, payload?: Array<Record<string, unknown>>) {
  if (!payload?.length) return;
  for (const schedule of payload) {
    const serviceName = text(schedule.serviceName);
    if (!serviceName) continue;
    await MineCareServiceSchedule.findOneAndUpdate(
      { equipmentId, serviceName, isDeleted: false },
      { equipmentId, equipmentType: text(schedule.equipmentType, equipmentType), serviceName, intervalHours: Math.max(1, number(schedule.intervalHours, 500)), requiredParts: cleanStringArray(schedule.requiredParts), estimatedCost: number(schedule.estimatedCost, 0), active: true, isDeleted: false, updated: now() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

function normalizeDocumentExtraction(payload: any) {
  return payload && typeof payload === 'object' ? payload : {};
}

function deterministicCopilotResponse(question: string, context: Awaited<ReturnType<typeof loadMineCareContext>>) {
  const lower = question.toLowerCase();
  const ranking = calculateRiskRankingFromContext(context);
  const services = serviceCalendarFromContext(context).upcomingServices;
  const actions = actionCenterFromContext(context);
  const matchedAssets = context.equipment.filter((item) => lower.includes(item.equipmentId.toLowerCase()) || lower.includes(item.name.toLowerCase()));
  if (matchedAssets.length) {
    return { answer: matchedAssets.map((item) => `${item.name} (${item.equipmentId}) has health score ${calculateHealthScore(context, item).score} and warranty status ${calculateWarrantyStatus(context, item).status}.`).join(' '), recommendedActions: actions.filter((action) => matchedAssets.some((asset) => asset.equipmentId === action.equipment)), referencedAssets: matchedAssets.map((item) => item.equipmentId), confidence: 0.78, source: 'deterministic-fallback' };
  }
  if (lower.includes('service')) return { answer: services.length ? `Upcoming services: ${services.slice(0, 5).map((service) => `${service.equipmentName} needs ${service.serviceName} in ${service.remainingDays} day(s)`).join('; ')}.` : 'No upcoming services are currently due.', recommendedActions: actions.filter((action) => action.source === 'Service Due Prediction'), referencedAssets: services.slice(0, 5).map((service) => service.equipmentId), confidence: 0.74, source: 'deterministic-fallback' };
  if (lower.includes('warrant')) return { answer: `Warranty attention is needed for ${context.equipment.map((item) => calculateWarrantyStatus(context, item)).filter((item) => item.status !== 'Active').map((item) => `${item.equipmentName} (${item.status})`).join(', ') || 'no assets'}.`, recommendedActions: actions.filter((action) => action.source === 'Warranty Tracker'), referencedAssets: [], confidence: 0.72, source: 'deterministic-fallback' };
  return { answer: `MineCare AI reviewed ${context.equipment.length} assets. Highest risk: ${ranking.slice(0, 3).map((risk) => `${risk.equipmentName} (${risk.priority})`).join(', ')}.`, recommendedActions: actions.slice(0, 5), referencedAssets: ranking.slice(0, 3).map((risk) => risk.equipmentId), confidence: 0.7, source: 'deterministic-fallback' };
}

export const mineCareAiService = {
  async extractEquipmentDocuments(files: Express.Multer.File[]) {
    if (!files.length) throw new AppError('At least one equipment document is required.', HTTP_STATUS.BAD_REQUEST);
    const form = new FormData();
    files.forEach((file) => form.append('documents', file.buffer, { filename: file.originalname, contentType: file.mimetype, knownLength: file.size }));
    const headers = form.getHeaders();
    const agenticApiKey = process.env.AGENTIC_SERVER_API_KEY || process.env.CREWAI_API_KEY;
    if (agenticApiKey) headers['x-agentic-api-key'] = agenticApiKey;
    try {
      const response = await axios.post(`${agenticServerBaseUrl()}/minecare-ai/extract-equipment-documents`, form, { headers, timeout: Number(process.env.MINECARE_AI_EXTRACTION_TIMEOUT_MS || 180000), maxBodyLength: Infinity, maxContentLength: Infinity });
      return enrichExtractionSummary(normalizeDocumentExtraction(response.data));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
        throw new AppError(`MineCare AI extraction failed: ${detail}`, error.response?.status && error.response.status < 500 ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.BAD_GATEWAY);
      }
      throw new AppError('MineCare AI extraction failed.', HTTP_STATUS.BAD_GATEWAY);
    }
  },

  async listEquipment(query: Record<string, unknown>) {
    await seedMineCareSampleData();
    const search = text(query.search).toLowerCase();
    const filter: any = { isDeleted: false };
    if (text(query.status)) filter.status = text(query.status);
    if (text(query.criticality)) filter.criticality = text(query.criticality);
    if (text(query.type)) filter.type = text(query.type);
    if (search) filter.$or = ['equipmentId', 'name', 'type', 'brand', 'modelName', 'location', 'vendor'].map((field) => ({ [field]: { $regex: search, $options: 'i' } }));
    const items = await MineCareEquipment.find(filter).sort({ updated: -1 }).lean();
    const context = await loadMineCareContext();
    return items.map((item) => ({ ...serializeEquipment(item), warranty: context.warranties.find((warranty) => warranty.equipmentId === item.equipmentId) ?? null, serviceSchedule: context.schedules.filter((schedule) => schedule.equipmentId === item.equipmentId || schedule.equipmentType === item.type) }));
  },

  async getEquipmentDetails(identifier: string) {
    const context = await loadMineCarePhase2Context();
    const item = findEquipment(context, identifier);
    if (!item) return null;
    const warranty = context.warranties.find((candidate) => candidate.equipmentId === item.equipmentId) ?? null;
    const purchaseDate = item.purchaseDate;
    const ageYears = Math.max(0, Math.round(((Date.now() - purchaseDate.getTime()) / (365 * DAY_MS)) * 10) / 10);
    const expectedLifeYears = item.criticality === 'Critical' ? 8 : 10;
    const health = calculateHealthScore(context, item);
    const warrantyStatus = calculateWarrantyStatus(context, item);
    const serviceDue = calculateServiceDue(context, item);
    const itemAlerts = alertsFromContext(context).filter((alert: any) => alert.equipmentId === item.equipmentId);
    const assetDocuments = await MineCareKnowledgeDocument.find({ isDeleted: false, equipmentId: item.equipmentId }).sort({ uploadedAt: -1 }).lean();
    const assetAiSummary = `${item.name} is a ${item.criticality.toLowerCase()} ${item.type} with health score ${health.score}, warranty status ${warrantyStatus.status}, and ${serviceDue ? `${serviceDue.serviceName} ${serviceDue.status.toLowerCase()}` : 'no active service due record'}.`;
    const nextBestAction = health.recommendations[0] || serviceDue?.aiRecommendedAction || warrantyStatus.aiRecommendation || 'Continue monitoring this asset through normal preventive maintenance controls.';
    const lifecycleRiskNarrative = ageYears >= expectedLifeYears * 0.75
      ? `Asset is in late lifecycle window at ${ageYears} years against expected life of ${expectedLifeYears} years; prioritize repair/replace review.`
      : `Asset is ${ageYears} years old against expected life of ${expectedLifeYears} years; current risk is driven more by service, observations, and warranty signals than age.`;
    const healthTimeline = [
      { date: item.purchaseDate, title: 'Asset Purchased', type: 'Purchase', severity: 'Low', description: `${item.vendor} invoice value $${item.invoiceValue.toLocaleString()}.`, source: 'Equipment Registry' },
      warranty ? { date: warranty.startDate, title: 'Warranty Started', type: 'Warranty', severity: 'Low', description: `${warranty.coveredComponents.join(', ') || 'Core components'} covered.`, source: 'Warranty Tracker' } : null,
      ...context.maintenanceHistory.filter((history) => history.equipmentId === item.equipmentId).map((history) => ({ date: history.serviceDate, title: history.serviceType, type: 'Service', severity: 'Low', description: history.actionTaken, source: 'Maintenance History' })),
      ...context.observations.filter((observation) => observation.equipmentId === item.equipmentId).map((observation) => ({ date: observation.observationDate, title: observation.observationType, type: 'Observation', severity: observation.severity, description: observation.description, source: 'Operator Observation' })),
      ...context.breakdowns.filter((breakdown) => breakdown.equipmentId === item.equipmentId).map((breakdown) => ({ date: breakdown.breakdownDate, title: breakdown.failureType, type: 'Breakdown', severity: breakdown.downtimeHours > 16 ? 'High' : 'Medium', description: `${breakdown.rootCause || 'Root cause pending'}; ${breakdown.downtimeHours} downtime hour(s).`, source: 'Breakdown Record' })),
      ...context.rootCauses.filter((analysis: any) => analysis.equipmentId === item.equipmentId).map((analysis: any) => ({ date: analysis.created ?? analysis.updated, title: `RCA: ${analysis.failureType}`, type: 'Root Cause', severity: analysis.confidence >= 0.75 ? 'Medium' : 'Low', description: analysis.likelyRootCauses?.[0] || analysis.problem, source: 'Root Cause Analysis' })),
      ...context.checklists.filter((checklist: any) => checklist.equipmentId === item.equipmentId).map((checklist: any) => ({ date: checklist.created ?? checklist.updated, title: checklist.checklistTitle, type: 'Checklist', severity: checklist.items?.every((task: any) => task.completed) ? 'Low' : 'Medium', description: `${checklist.items?.filter((task: any) => task.completed).length ?? 0}/${checklist.items?.length ?? 0} checklist items completed.`, source: 'Checklist Generator' })),
      ...context.repairReplaceAnalyses.filter((analysis: any) => analysis.equipmentId === item.equipmentId).map((analysis: any) => ({ date: analysis.created ?? analysis.updated, title: `Repair/Replace: ${analysis.recommendation}`, type: 'Repair Replace', severity: analysis.recommendation === 'Replace' ? 'High' : 'Medium', description: analysis.reason, source: 'Repair vs Replace Advisor' })),
      ...itemAlerts.map((alert: any) => ({ date: alert.dueDate ?? now(), title: alert.type, type: 'Alert', severity: alert.severity, description: alert.message, source: 'Alerts Center' })),
      warranty ? { date: warranty.endDate, title: 'Warranty Ends', type: 'Warranty', severity: warrantyStatus.status === 'Expired' ? 'High' : warrantyStatus.status === 'Expiring Soon' ? 'Medium' : 'Low', description: warrantyStatus.status, source: 'Warranty Tracker' } : null,
      { date: now(), title: 'Current Health State', type: 'Health', severity: health.riskLevel, description: `Health score ${health.score}; ${health.recommendations.join(' ') || 'no active AI recommendation for this asset.'}`, source: 'MineCare AI' },
    ].filter(Boolean).sort((left: any, right: any) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const details = {
      equipment: item,
      warranty,
      warrantyStatus,
      serviceDue,
      serviceSchedule: context.schedules.filter((schedule) => schedule.equipmentId === item.equipmentId || schedule.equipmentType === item.type),
      health,
      maintenanceHistory: context.maintenanceHistory.filter((history) => history.equipmentId === item.equipmentId),
      breakdownHistory: context.breakdowns.filter((breakdown) => breakdown.equipmentId === item.equipmentId),
      observations: context.observations.filter((observation) => observation.equipmentId === item.equipmentId),
      documents: assetDocuments,
      assetAiSummary,
      nextBestAction,
      lifecycleRiskNarrative,
      lifecycleTimeline: [
        { label: 'Purchased', date: item.purchaseDate, detail: `${item.vendor} invoice value $${item.invoiceValue.toLocaleString()}` },
        ...context.maintenanceHistory.filter((history) => history.equipmentId === item.equipmentId).map((history) => ({ label: history.serviceType, date: history.serviceDate, detail: history.actionTaken })),
        ...context.breakdowns.filter((breakdown) => breakdown.equipmentId === item.equipmentId).map((breakdown) => ({ label: 'Breakdown', date: breakdown.breakdownDate, detail: breakdown.failureType })),
        warranty ? { label: 'Warranty End', date: warranty.endDate, detail: calculateWarrantyStatus(context, item).status } : null,
      ].filter(Boolean),
      healthTimeline,
      lifecycleTracker: { purchaseDate, currentAge: `${ageYears} years`, warrantyStatus: calculateWarrantyStatus(context, item).status, expectedLife: `${expectedLifeYears} years`, replacementYear: purchaseDate.getFullYear() + expectedLifeYears },
    };
    return enrichMineCareAi('asset-passport', details, compactMineCareContext({
      ...context,
      equipment: [item],
      warranties: warranty ? [warranty] : [],
      schedules: details.serviceSchedule,
      maintenanceHistory: details.maintenanceHistory,
      breakdowns: details.breakdownHistory,
      observations: details.observations,
    }), 'Enhance assetAiSummary, nextBestAction, lifecycleRiskNarrative, health recommendations, and service/warranty AI guidance only.');
  },

  async createEquipment(payload: EquipmentPayload) {
    await seedMineCareSampleData();
    const equipmentId = text(payload.equipmentId, `MCA-${Date.now()}`);
    if (await MineCareEquipment.exists({ equipmentId, isDeleted: false })) throw new AppError('MineCare equipment ID already exists.', HTTP_STATUS.CONFLICT);
    const item = await MineCareEquipment.create({ equipmentId, name: text(payload.name, 'New Equipment'), type: text(payload.type, 'General Equipment'), brand: text(payload.brand, 'Unknown'), modelName: text((payload as any).model, 'Unknown'), serialNumber: text(payload.serialNumber, `SN-${Date.now()}`), location: text(payload.location, 'Unassigned'), department: text(payload.department, 'Operations'), purchaseDate: dateFrom(payload.purchaseDate, now()), invoiceValue: number(payload.invoiceValue, 0), vendor: text(payload.vendor, 'Unknown Vendor'), currentRunningHours: number(payload.currentRunningHours, 0), averageDailyUsage: Math.max(1, number(payload.averageDailyUsage, 8)), status: normalizeStatus(payload.status), criticality: normalizeCriticality(payload.criticality), active: true, isDeleted: false, created: now(), updated: now() });
    await upsertWarranty(equipmentId, item.purchaseDate, payload.warranty);
    await upsertServiceSchedules(equipmentId, item.type, payload.serviceSchedules);
    return this.getEquipmentDetails(item.equipmentId);
  },

  async updateEquipment(identifier: string, payload: EquipmentPayload) {
    const current = await MineCareEquipment.findOne(equipmentIdentifierFilter(identifier));
    if (!current) return null;
    const oldEquipmentId = current.equipmentId;
    const nextEquipmentId = text(payload.equipmentId, current.equipmentId);
    Object.assign(current, {
      equipmentId: nextEquipmentId,
      name: text(payload.name, current.name),
      type: text(payload.type, current.type),
      brand: text(payload.brand, current.brand),
      modelName: text((payload as any).model, current.modelName),
      serialNumber: text(payload.serialNumber, current.serialNumber),
      location: text(payload.location, current.location),
      department: text(payload.department, current.department),
      purchaseDate: dateFrom(payload.purchaseDate, current.purchaseDate),
      invoiceValue: number(payload.invoiceValue, current.invoiceValue),
      vendor: text(payload.vendor, current.vendor),
      currentRunningHours: number(payload.currentRunningHours, current.currentRunningHours),
      averageDailyUsage: Math.max(1, number(payload.averageDailyUsage, current.averageDailyUsage)),
      status: normalizeStatus(payload.status ?? current.status),
      criticality: normalizeCriticality(payload.criticality ?? current.criticality),
      updated: now(),
    });
    await current.save();
    if (oldEquipmentId !== nextEquipmentId) {
      await Promise.all([MineCareWarranty.updateMany({ equipmentId: oldEquipmentId }, { equipmentId: nextEquipmentId, updated: now() }), MineCareServiceSchedule.updateMany({ equipmentId: oldEquipmentId }, { equipmentId: nextEquipmentId, updated: now() }), MineCareMaintenanceHistory.updateMany({ equipmentId: oldEquipmentId }, { equipmentId: nextEquipmentId, updated: now() }), MineCareBreakdownRecord.updateMany({ equipmentId: oldEquipmentId }, { equipmentId: nextEquipmentId, updated: now() }), MineCareOperatorObservation.updateMany({ equipmentId: oldEquipmentId }, { equipmentId: nextEquipmentId, updated: now() })]);
    }
    await upsertWarranty(nextEquipmentId, current.purchaseDate, payload.warranty);
    await upsertServiceSchedules(nextEquipmentId, current.type, payload.serviceSchedules);
    return this.getEquipmentDetails(nextEquipmentId);
  },

  async deleteEquipment(identifier: string) {
    const item = await MineCareEquipment.findOneAndUpdate(equipmentIdentifierFilter(identifier), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    if (!item) return false;
    await Promise.all([MineCareWarranty.updateMany({ equipmentId: item.equipmentId }, { isDeleted: true, deletedAt: now(), active: false, updated: now() }), MineCareServiceSchedule.updateMany({ equipmentId: item.equipmentId }, { isDeleted: true, deletedAt: now(), active: false, updated: now() }), MineCareOperatorObservation.updateMany({ equipmentId: item.equipmentId }, { isDeleted: true, deletedAt: now(), active: false, updated: now() })]);
    return true;
  },

  async getDashboardSummary() {
    const context = await loadMineCarePhase2Context();
    const ranking = calculateRiskRankingFromContext(context);
    const warrantyStatuses = context.equipment.map((item) => calculateWarrantyStatus(context, item));
    const health = context.equipment.map((item) => calculateHealthScore(context, item));
    const alerts = alertsFromContext(context);
    const budget = budgetFromContext(context);
    const weeklyServices = serviceCalendarFromContext(context).weeklyCalendar;
    const savings = calculateMineCareSavings(context, { repairReplaceAnalyses: context.repairReplaceAnalyses, downtimeScenarios: context.downtimeScenarios });
    const recommendations = await syncRecommendations(context);
    const criticalCount = ranking.filter((risk) => risk.priority === 'Critical').length;
    const expiringWarrantyCount = warrantyStatuses.filter((warranty) => warranty.status === 'Expiring Soon').length;
    const summary = {
      cards: {
        totalEquipment: context.equipment.length,
        criticalAssets: criticalCount,
        serviceDueThisWeek: weeklyServices.length,
        warrantyExpiringSoon: expiringWarrantyCount,
        sparePartShortages: forecastSparePartsFromContext(context).filter((part) => part.reorderRecommended).length,
        estimatedCostExposure: budget.costExposure,
        potentialSavings: budget.potentialSavings,
      },
      commandCenter: {
        fleetHealthPercent: health.length ? Math.round(health.reduce((sum, item) => sum + item.score, 0) / health.length) : 0,
        healthyAssets: health.filter((item) => item.status === 'Good').length,
        warningAssets: health.filter((item) => item.status === 'Medium' || item.status === 'High Risk').length,
        criticalAssets: health.filter((item) => item.status === 'Critical').length,
        serviceDueThisWeek: weeklyServices.length,
        warrantyRecoveryOpportunity: savings.warrantyRecoveryOpportunity,
        estimatedDowntimeAvoided: savings.estimatedDowntimeAvoided,
        aiEstimatedSavings: savings.totalEstimatedSavings,
        costExposure: budget.costExposure,
      },
      savings,
      topRecommendations: recommendations.slice(0, 5),
      healthScoreDistribution: { good: health.filter((item) => item.status === 'Good').length, medium: health.filter((item) => item.status === 'Medium').length, highRisk: health.filter((item) => item.status === 'High Risk').length, critical: health.filter((item) => item.status === 'Critical').length },
      topRiskAssets: ranking.slice(0, 5),
      upcomingServices: serviceCalendarFromContext(context).upcomingServices.slice(0, 6),
      warrantyAlerts: alerts.filter((alert) => alert.type === 'Warranty Alert'),
      aiExecutiveSummary: `MineCare AI is tracking ${context.equipment.length} asset(s), ${criticalCount} critical risk asset(s), ${weeklyServices.length} service event(s) due this week, and ${expiringWarrantyCount} expiring warranty item(s). Estimated AI savings opportunity is ${savings.totalEstimatedSavings}.`,
      aiDecisionBrief: [
        criticalCount ? 'Review critical assets before production dispatch.' : 'No critical asset requires immediate escalation.',
        weeklyServices.length ? 'Lock service capacity for due-this-week work.' : 'Use service capacity for inspections and backlog work.',
        expiringWarrantyCount ? 'Audit open failures for warranty claim recovery.' : 'Warranty exposure is currently controlled.',
      ],
    };
    return enrichMineCareAi('dashboard-summary', summary, compactMineCareContext(context), 'Enhance aiExecutiveSummary, aiDecisionBrief, top recommendation reasoning, risk actions, service actions, and warranty alert actions only.');
  },

  async getServiceCalendar() {
    const context = await loadMineCareContext();
    const calendar = serviceCalendarFromContext(context);
    return enrichMineCareAi('service-calendar', calendar, compactMineCareContext(context), 'Enhance service aiReason, aiRecommendedAction, aiPriority, aiSummary, aiRecommendedPlan, and warranty inspection recommendations only.');
  },
  async completeService(payload: Record<string, unknown>) {
    await seedMineCareSampleData();
    const equipmentId = text(payload.equipmentId);
    const serviceName = text(payload.serviceName);
    const equipment = await MineCareEquipment.findOne({ equipmentId, isDeleted: false });
    if (!equipment) throw new AppError('Selected MineCare equipment was not found.', HTTP_STATUS.BAD_REQUEST);
    if (!serviceName) throw new AppError('Service name is required.', HTTP_STATUS.BAD_REQUEST);

    const schedule = await MineCareServiceSchedule.findOne({ equipmentId, serviceName, isDeleted: false }).lean()
      ?? await MineCareServiceSchedule.findOne({ equipmentType: equipment.type, serviceName, isDeleted: false }).lean()
      ?? await MineCareServiceSchedule.findOne({ equipmentId, isDeleted: false }).lean()
      ?? await MineCareServiceSchedule.findOne({ equipmentType: equipment.type, isDeleted: false }).lean();
    const runningHours = Math.max(0, number(payload.runningHours, equipment.currentRunningHours));
    const completedAt = dateFrom(payload.serviceDate, now());
    const downtimeHours = Math.max(0, number(payload.downtimeHours, 0));
    const cost = Math.max(0, number(payload.cost, schedule?.estimatedCost ?? 0));
    const actionTaken = text(payload.actionTaken, `Completed ${serviceName} and updated maintenance record.`);
    const technician = text(payload.technician, 'Maintenance Team');
    const consumedParts = await consumeServiceRequiredParts(cleanStringArray(schedule?.requiredParts), equipment.type);

    const maintenanceHistory = await MineCareMaintenanceHistory.create({
      equipmentId,
      serviceDate: completedAt,
      serviceType: serviceName,
      runningHours,
      actionTaken,
      technician,
      cost,
      downtimeHours,
      active: true,
      isDeleted: false,
      created: now(),
      updated: now(),
    });

    equipment.currentRunningHours = Math.max(equipment.currentRunningHours, runningHours);
    equipment.status = 'Operational';
    equipment.updated = now();
    await equipment.save();

    return {
      maintenanceHistory: maintenanceHistory.toObject(),
      consumedParts,
      equipment: serializeEquipment(equipment.toObject()),
    };
  },
  async recordBreakdownRepair(payload: Record<string, unknown>) {
    await seedMineCareSampleData();
    const equipmentId = text(payload.equipmentId);
    const failureType = text(payload.failureType);
    const equipment = await MineCareEquipment.findOne({ equipmentId, isDeleted: false });
    if (!equipment) throw new AppError('Selected MineCare equipment was not found.', HTTP_STATUS.BAD_REQUEST);
    if (!failureType) throw new AppError('Failure type is required.', HTTP_STATUS.BAD_REQUEST);

    const breakdownDate = dateFrom(payload.breakdownDate, now());
    const repairCost = Math.max(0, number(payload.repairCost, 0));
    const downtimeHours = Math.max(0, number(payload.downtimeHours, 0));
    const rootCause = text(payload.rootCause, 'Root cause pending review.');
    const component = text(payload.component);
    const runningHours = Math.max(0, number(payload.runningHours, equipment.currentRunningHours));
    const repaired = payload.repaired !== false;
    const createMaintenanceRecord = payload.createMaintenanceRecord !== false;

    const breakdown = await MineCareBreakdownRecord.create({
      equipmentId,
      breakdownDate,
      failureType,
      component,
      rootCause,
      repairCost,
      downtimeHours,
      warrantyClaimRaised: Boolean(payload.warrantyClaimRaised),
      active: true,
      isDeleted: false,
      created: now(),
      updated: now(),
    });

    let maintenanceHistory = null;
    if (createMaintenanceRecord) {
      maintenanceHistory = await MineCareMaintenanceHistory.create({
        equipmentId,
        serviceDate: breakdownDate,
        serviceType: `Breakdown Repair - ${failureType}`,
        runningHours,
        actionTaken: text(payload.actionTaken, `Repaired ${failureType}${component ? ` on ${component}` : ''}.`),
        technician: text(payload.technician, 'Maintenance Team'),
        cost: repairCost,
        downtimeHours,
        active: true,
        isDeleted: false,
        created: now(),
        updated: now(),
      });
    }

    equipment.currentRunningHours = Math.max(equipment.currentRunningHours, runningHours);
    equipment.status = repaired ? 'Operational' : 'Breakdown';
    equipment.updated = now();
    await equipment.save();

    return {
      breakdown: breakdown.toObject(),
      maintenanceHistory: maintenanceHistory ? maintenanceHistory.toObject() : null,
      equipment: serializeEquipment(equipment.toObject()),
    };
  },
  async calculateRiskRanking() {
    const context = await loadMineCareContext();
    const ranking = calculateRiskRankingFromContext(context);
    return enrichMineCareAi('risk-ranking', ranking, compactMineCareContext(context), 'Enhance aiExplanation and nextBestAction for each risk record. Preserve equipment IDs, scores, and statuses.');
  },
  async getWarrantyAlerts() {
    const context = await loadMineCareContext();
    const warranties = context.equipment.map((item) => calculateWarrantyStatus(context, item));
    return enrichMineCareAi('warranty-tracker', warranties, compactMineCareContext(context), 'Enhance aiRecommendation for each warranty record. Preserve warranty dates, statuses, and hour values.');
  },
  async findWarrantyClaims() {
    const context = await loadMineCareContext();
    const claims = warrantyClaimsFromContext(context);
    return enrichMineCareAi('warranty-claim-finder', claims, compactMineCareContext(context), 'Enhance claimProbability, aiExplanation, missingDocuments, and recommendation for each claim. Preserve IDs, statuses, and recoverable cost.');
  },
  async listObservations() { await seedMineCareSampleData(); return MineCareOperatorObservation.find({ isDeleted: false }).sort({ observationDate: -1 }).lean(); },
  async createObservation(payload: Partial<IMineCareOperatorObservation>) {
    await seedMineCareSampleData();
    const equipmentId = text(payload.equipmentId);
    if (!await MineCareEquipment.exists({ equipmentId, isDeleted: false })) throw new AppError('Selected MineCare equipment was not found.', HTTP_STATUS.BAD_REQUEST);
    return MineCareOperatorObservation.create({ equipmentId, observationDate: dateFrom(payload.observationDate, now()), observationType: text(payload.observationType, 'Operator Observation'), description: text(payload.description), severity: normalizeSeverity(payload.severity), active: true, isDeleted: false, created: now(), updated: now() });
  },
  async generateAlerts() {
    const context = await loadMineCareContext();
    const alerts = alertsFromContext(context);
    return enrichMineCareAi('alerts-center', alerts, compactMineCareContext(context), 'Enhance aiPriorityScore, aiReason, recommendedAction, severity wording, and message clarity. Preserve alert IDs and statuses.');
  },
  async forecastSpareParts() {
    const context = await loadMineCareContext();
    const parts = forecastSparePartsFromContext(context);
    return enrichMineCareAi('spare-parts-planner', parts, compactMineCareContext(context), 'Enhance shortageRisk, aiRecommendation, and stockingStrategy for each part. Preserve part numbers, stock, reorder quantities, and costs.');
  },
  async forecastBudget() {
    const context = await loadMineCareContext();
    const budget = budgetFromContext(context);
    return enrichMineCareAi('budget-forecast', budget, compactMineCareContext(context), 'Enhance aiNarrative, costDrivers, and recommendedActions. Preserve all budget numbers.');
  },
  async generateActionCenter() {
    const context = await loadMineCareContext();
    const actions = actionCenterFromContext(context);
    return enrichMineCareAi('action-center', actions, compactMineCareContext(context), 'Enhance action wording, priority reasoning, and source-specific recommendation language. Preserve action IDs and statuses.');
  },
  async listRecommendations() {
    const context = await loadMineCarePhase2Context();
    const items = await syncRecommendations(context);
    const sorted = items.sort((left: any, right: any) => priorityRank(left.priority) - priorityRank(right.priority) || number(right.estimatedSavings, 0) - number(left.estimatedSavings, 0));
    return enrichMineCareAi('recommendations', sorted, compactMineCareContext(context), 'Enhance recommendation title, reason, recommendedAction, estimatedImpact, priority, and confidence. Preserve recommendation IDs, statuses, equipment IDs, and estimated savings.');
  },
  async updateRecommendationStatus(id: string, status: 'Open' | 'In Progress' | 'Completed' | 'Dismissed') {
    const context = await loadMineCarePhase2Context();
    await syncRecommendations(context);
    const item = await MineCareRecommendation.findOneAndUpdate(idFilter('recommendationId', id), { status, updated: now() }, { new: true });
    if (!item) return null;
    return item.toObject();
  },
  async generateExecutiveReport(period: 'weekly' | 'monthly' = 'weekly') {
    const context = await loadMineCarePhase2Context();
    const report = reportFromContext(context, period, {
      rootCauses: context.rootCauses,
      repairReplaceAnalyses: context.repairReplaceAnalyses,
      procurementComparisons: context.procurementComparisons,
      downtimeScenarios: context.downtimeScenarios,
      recommendations: await syncRecommendations(context),
    });
    const enrichedReport = await enrichMineCareAi('executive-report', report, compactMineCareContext(context), 'Enhance report narrative fields, AI recommendations, recommended actions, budget explanation, and section highlights. Preserve all IDs, statuses, dates, and numeric values.');
    await MineCareReportHistory.create({ period, report: enrichedReport, generatedAt: enrichedReport.generatedAt, active: true, isDeleted: false, created: now(), updated: now() });
    return enrichedReport;
  },
  async generateExecutiveReportPdf(period: MineCareReportPeriod = 'weekly') {
    const report = await this.generateExecutiveReport(period);
    const fileName = `minecare-ai-${period}-executive-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.pdf`;
    return {
      fileName,
      contentType: 'application/pdf',
      buffer: await buildMineCareExecutiveReportPdf(report as Record<string, any>),
    };
  },
  async generateCopilotResponse(question: string) {
    const context = await loadMineCareContext();
    const documentSnippets = await relevantKnowledgeSnippets(question, context);
    const baseFallback = deterministicCopilotResponse(question, context);
    const fallback = documentSnippets.length
      ? {
          ...baseFallback,
          answer: `${baseFallback.answer} Uploaded document evidence: ${documentSnippets.slice(0, 3).map((item) => `${item.documentName}${item.equipmentId ? ` (${item.equipmentId})` : ''}: ${item.snippet}`).join(' ')}`.slice(0, 1800),
          confidence: Math.max(baseFallback.confidence, 0.76),
        }
      : baseFallback;
    const headers: Record<string, string> = {};
    const agenticApiKey = process.env.AGENTIC_SERVER_API_KEY || process.env.CREWAI_API_KEY;
    if (agenticApiKey) headers['x-agentic-api-key'] = agenticApiKey;
    try {
      const response = await axios.post(`${agenticServerBaseUrl()}/minecare-ai/copilot`, { question, context: { dashboardSummary: await this.getDashboardSummary(), riskRanking: calculateRiskRankingFromContext(context), serviceCalendar: serviceCalendarFromContext(context), warrantyAlerts: context.equipment.map((item) => calculateWarrantyStatus(context, item)), spareParts: forecastSparePartsFromContext(context), budgetForecast: budgetFromContext(context), actionCenter: actionCenterFromContext(context), uploadedDocumentSnippets: documentSnippets } }, { headers, timeout: Number(process.env.MINECARE_AI_COPILOT_TIMEOUT_MS || 60000) });
      const payload = response.data && typeof response.data === 'object' ? response.data : {};
      return { answer: text(payload.answer, fallback.answer), recommendedActions: Array.isArray(payload.recommendedActions) ? payload.recommendedActions : fallback.recommendedActions, referencedAssets: Array.isArray(payload.referencedAssets) ? payload.referencedAssets.map(String) : fallback.referencedAssets, confidence: Math.max(0, Math.min(1, number(payload.confidence, fallback.confidence))), source: 'agentic-server' };
    } catch (_error) {
      return fallback;
    }
  },
  async updateAlertStatus(id: string, status: 'Open' | 'Acknowledged' | 'Closed') {
    const context = await loadMineCareContext();
    const alert = alertsFromContext(context).find((item) => item.id === id);
    const equipmentId = alert && 'equipmentId' in alert ? alert.equipmentId : undefined;
    await MineCareAlertStatus.findOneAndUpdate({ alertId: id, isDeleted: false }, { alertId: id, equipmentId, alertType: alert?.type ?? 'MineCare Alert', title: alert?.type, message: alert?.message ?? id, severity: alert?.severity ?? 'Medium', source: alert?.type, status, active: true, isDeleted: false, updated: now() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { ...(alert ?? { id }), status };
  },
  async updateActionStatus(id: string, status: 'Open' | 'In Progress' | 'Completed') {
    const context = await loadMineCareContext();
    const action = actionCenterFromContext(context).find((item) => item.id === id);
    await MineCareActionStatus.findOneAndUpdate({ actionId: id, isDeleted: false }, { actionId: id, equipmentId: action?.equipment, priority: action?.priority ?? 'Medium', action: action?.action ?? id, reason: action?.source, status, active: true, isDeleted: false, updated: now() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { ...(action ?? { id }), status };
  },
  async updateWarrantyClaimStatus(id: string, status: 'Potential' | 'Submitted' | 'Approved' | 'Rejected') {
    const context = await loadMineCareContext();
    const claim = warrantyClaimsFromContext(context).find((item) => item.id === id);
    await MineCareWarrantyClaimStatus.findOneAndUpdate({ claimId: id, isDeleted: false }, { claimId: id, equipmentId: claim?.equipmentId ?? '', component: claim?.component, failureType: claim?.failureType ?? 'Warranty Claim', recoverableCost: claim?.recoverableCost ?? 0, recommendation: claim?.recommendation ?? '', status, active: true, isDeleted: false, updated: now() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { ...(claim ?? { id }), status };
  },

  async listRootCauseAnalyses() {
    await seedMineCarePhase2SampleData();
    return MineCareRootCauseAnalysis.find({ isDeleted: false }).sort({ updated: -1 }).lean();
  },
  async analyzeRootCause(payload: Record<string, unknown>) {
    const context = await loadMineCareContext();
    const fallback = deterministicRootCause(payload, context);
    const ai = await postAgenticJson('/minecare-ai/root-cause/analyze', { ...payload, context: { equipment: context.equipment, breakdowns: context.breakdowns, observations: context.observations, maintenanceHistory: context.maintenanceHistory } }, fallback);
    const analysis = await MineCareRootCauseAnalysis.create({
      analysisId: generatedId('RCA'),
      equipmentId: text(ai.equipmentId, fallback.equipmentId),
      equipmentName: text(ai.equipmentName, fallback.equipmentName),
      failureType: text(ai.failureType, fallback.failureType),
      component: text(ai.component, fallback.component),
      problem: text(ai.problem, fallback.problem),
      likelyRootCauses: cleanStringArray((ai as any).likelyRootCauses).length ? cleanStringArray((ai as any).likelyRootCauses) : fallback.likelyRootCauses,
      evidence: cleanStringArray((ai as any).evidence).length ? cleanStringArray((ai as any).evidence) : fallback.evidence,
      recommendedActions: cleanStringArray((ai as any).recommendedActions).length ? cleanStringArray((ai as any).recommendedActions) : fallback.recommendedActions,
      causeConfidence: Array.isArray((ai as any).causeConfidence) && (ai as any).causeConfidence.length ? (ai as any).causeConfidence : fallback.causeConfidence,
      preventiveControls: cleanStringArray((ai as any).preventiveControls).length ? cleanStringArray((ai as any).preventiveControls) : fallback.preventiveControls,
      evidenceSummary: text((ai as any).evidenceSummary, fallback.evidenceSummary),
      confidence: number((ai as any).confidence, fallback.confidence),
      aiProvider: text((ai as any).aiProvider, 'deterministic-fallback'),
      status: 'Draft',
      active: true,
      isDeleted: false,
      created: now(),
      updated: now(),
    });
    return analysis.toObject();
  },
  async getRootCauseAnalysis(id: string) {
    await seedMineCarePhase2SampleData();
    return MineCareRootCauseAnalysis.findOne(idFilter('analysisId', id)).lean();
  },
  async deleteRootCauseAnalysis(id: string) {
    const item = await MineCareRootCauseAnalysis.findOneAndUpdate(idFilter('analysisId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },

  async listChecklists() {
    await seedMineCarePhase2SampleData();
    const items = await MineCareChecklist.find({ isDeleted: false }).sort({ updated: -1 }).lean();
    return items.map(withChecklistProgress);
  },
  async generateChecklist(payload: Record<string, unknown>) {
    const context = await loadMineCareContext();
    const fallback = deterministicChecklist(payload, context);
    const ai = await postAgenticJson('/minecare-ai/checklists/generate', { ...payload, context: { equipment: context.equipment, schedules: context.schedules, spareParts: context.spareParts } }, fallback);
    const checklistId = generatedId('CHK');
    const items = (Array.isArray((ai as any).items) && (ai as any).items.length ? (ai as any).items : fallback.items).map((item: any, index: number) => ({
      itemId: text(item.itemId, `${checklistId}-${index + 1}`),
      step: number(item.step, index + 1),
      task: text(item.task, `Checklist step ${index + 1}`),
      safetyNote: text(item.safetyNote),
      requiredPart: text(item.requiredPart),
      estimatedTimeMinutes: number(item.estimatedTimeMinutes, 20),
      completed: Boolean(item.completed),
    }));
    const checklist = await MineCareChecklist.create({
      checklistId,
      equipmentId: text((ai as any).equipmentId, fallback.equipmentId),
      equipmentName: text((ai as any).equipmentName, fallback.equipmentName),
      serviceType: text((ai as any).serviceType, fallback.serviceType),
      checklistTitle: text((ai as any).checklistTitle, fallback.checklistTitle),
      items,
      safetyPrecautions: cleanStringArray((ai as any).safetyPrecautions).length ? cleanStringArray((ai as any).safetyPrecautions) : fallback.safetyPrecautions,
      requiredTools: cleanStringArray((ai as any).requiredTools).length ? cleanStringArray((ai as any).requiredTools) : fallback.requiredTools,
      requiredParts: cleanStringArray((ai as any).requiredParts).length ? cleanStringArray((ai as any).requiredParts) : fallback.requiredParts,
      skillRequirement: text((ai as any).skillRequirement, fallback.skillRequirement),
      qualityGate: text((ai as any).qualityGate, fallback.qualityGate),
      aiPreparationNotes: cleanStringArray((ai as any).aiPreparationNotes).length ? cleanStringArray((ai as any).aiPreparationNotes) : fallback.aiPreparationNotes,
      confidence: number((ai as any).confidence, fallback.confidence),
      status: 'Active',
      active: true,
      isDeleted: false,
      created: now(),
      updated: now(),
    });
    return withChecklistProgress(checklist.toObject());
  },
  async getChecklist(id: string) {
    await seedMineCarePhase2SampleData();
    const item = await MineCareChecklist.findOne(idFilter('checklistId', id)).lean();
    return item ? withChecklistProgress(item) : null;
  },
  async updateChecklist(id: string, payload: Record<string, unknown>) {
    const item = await MineCareChecklist.findOne(idFilter('checklistId', id));
    if (!item) return null;
    item.checklistTitle = text(payload.checklistTitle, item.checklistTitle);
    item.serviceType = text(payload.serviceType, item.serviceType);
    item.status = (['Draft', 'Active', 'Completed'].includes(text(payload.status)) ? text(payload.status) : item.status) as any;
    item.updated = now();
    await item.save();
    return withChecklistProgress(item.toObject());
  },
  async deleteChecklist(id: string) {
    const item = await MineCareChecklist.findOneAndUpdate(idFilter('checklistId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },
  async updateChecklistItem(id: string, itemId: string, completed: boolean) {
    const checklist = await MineCareChecklist.findOne(idFilter('checklistId', id));
    if (!checklist) return null;
    const checklistItem = checklist.items.find((item) => item.itemId === itemId);
    if (!checklistItem) return null;
    checklistItem.completed = completed;
    checklist.status = checklist.items.every((item) => item.completed) ? 'Completed' : checklist.status === 'Completed' ? 'Active' : checklist.status;
    checklist.updated = now();
    await checklist.save();
    return withChecklistProgress(checklist.toObject());
  },

  async uploadKnowledgeDocument(files: Express.Multer.File[], payload: Record<string, unknown>) {
    if (!files.length) throw new AppError('At least one MineCare knowledge document is required.', HTTP_STATUS.BAD_REQUEST);
    const savedDocuments = [];
    for (const file of files) {
      const documentId = generatedId('KDOC');
      const storedFile = await uploadService.uploadFile({ file, moduleName: 'minecare-ai-equipment-documents' });
      const documentType = inferMineCareDocumentType(file.originalname, payload.documentType);
      const isPlainText = file.mimetype.startsWith('text/') || file.originalname.toLowerCase().endsWith('.txt') || file.originalname.toLowerCase().endsWith('.csv');
      const plainText = isPlainText
        ? file.buffer.toString('utf-8')
        : '';
      let extractedText = plainText;
      let extractionFailed = false;
      let errorMessage = '';
      try {
        if (!isPlainText) {
          const form = new FormData();
          form.append('documents', file.buffer, { filename: file.originalname, contentType: file.mimetype, knownLength: file.size });
          form.append('documentType', documentType);
          form.append('equipmentId', text(payload.equipmentId));
          form.append('equipmentType', text(payload.equipmentType));
          const response = await axios.post(`${agenticServerBaseUrl()}/minecare-ai/knowledge/ingest`, form, { headers: agenticHeaders(form.getHeaders()), timeout: Number(process.env.MINECARE_AI_KNOWLEDGE_TIMEOUT_MS || 180000), maxBodyLength: Infinity, maxContentLength: Infinity });
          extractedText = text(response.data?.text);
        }
      } catch (_error) {
        extractionFailed = !isPlainText;
        errorMessage = isPlainText ? '' : 'Document was uploaded but could not be processed. Please upload a clearer PDF or image.';
      }
      if (!text(extractedText)) {
        extractionFailed = true;
        errorMessage = errorMessage || 'Document was uploaded but no readable text was extracted.';
      }
      const chunks = knowledgeChunksFromText(documentId, file.originalname, extractedText, payload);
      if (!extractionFailed && chunks.length) await MineCareKnowledgeChunk.insertMany(chunks);
      const document = await MineCareKnowledgeDocument.create({
        documentId,
        fileName: file.originalname,
        originalName: file.originalname,
        documentType: documentType as any,
        equipmentId: text(payload.equipmentId),
        equipmentType: text(payload.equipmentType),
        uploadSource: text(payload.uploadSource, 'knowledge-assistant'),
        fileUrl: storedFile.fileUrl,
        mimeType: storedFile.mimeType,
        fileSize: storedFile.sizeBytes,
        uploadedAt: now(),
        extractedTextPreview: extractionFailed ? '' : extractedText.slice(0, 500),
        chunkCount: extractionFailed ? 0 : chunks.length,
        status: extractionFailed ? 'Failed' : 'Ready',
        errorMessage: extractionFailed ? errorMessage : undefined,
        active: true,
        isDeleted: false,
        created: now(),
        updated: now(),
      });
      savedDocuments.push(document.toObject());
    }
    return savedDocuments;
  },
  async listKnowledgeDocuments() {
    await seedMineCarePhase2SampleData();
    return MineCareKnowledgeDocument.find({ isDeleted: false }).sort({ uploadedAt: -1 }).lean();
  },
  async deleteKnowledgeDocument(id: string) {
    const item = await MineCareKnowledgeDocument.findOneAndUpdate(idFilter('documentId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    if (!item) return false;
    await MineCareKnowledgeChunk.updateMany({ documentId: item.documentId }, { isDeleted: true, deletedAt: now(), active: false, updated: now() });
    return true;
  },
  async askKnowledgeAssistant(payload: Record<string, unknown>) {
    await seedMineCarePhase2SampleData();
    const question = text(payload.question);
    const context = await loadMineCareContext();
    const preferredEquipmentIds = mentionedEquipmentIds(question, context.equipment);
    const documentFilter: any = { isDeleted: false, status: 'Ready' };
    if (preferredEquipmentIds.length) documentFilter.equipmentId = { $in: preferredEquipmentIds };
    const readyDocumentIds = await MineCareKnowledgeDocument.find(documentFilter).distinct('documentId');
    if (!readyDocumentIds.length) {
      return { answer: preferredEquipmentIds.length ? 'No processed documents are linked to the requested equipment. Upload onboarding, warranty, OEM, or service documents for that asset and ask again.' : 'Upload and process a document before asking questions.', citations: [], confidence: 0, aiProvider: 'deterministic-fallback' };
    }
    const chunks = await MineCareKnowledgeChunk.find({ isDeleted: false, documentId: { $in: readyDocumentIds } }).lean();
    const scored = scoreKnowledgeChunks(question, chunks, preferredEquipmentIds, 5);
    const fallback = {
      answer: scored.length ? scored.map((item) => item.chunk.text).join(' ').slice(0, 900) : preferredEquipmentIds.length ? 'No matching content was found in documents linked to the requested equipment.' : 'No matching MineCare knowledge document content was found. Upload OEM manuals, SOPs, or warranty terms and ask again.',
      sources: scored.map((item) => ({ documentId: item.chunk.documentId, documentName: item.chunk.documentName, section: item.chunk.section, pageNumber: undefined, chunkIndex: item.chunk.chunkIndex, snippet: item.chunk.text.slice(0, 220), confidence: Math.min(0.92, 0.55 + item.score * 0.05) })),
      citations: scored.map((item) => ({ documentId: item.chunk.documentId, documentName: item.chunk.documentName, section: item.chunk.section, snippet: item.chunk.text.slice(0, 220), confidence: Math.min(0.92, 0.55 + item.score * 0.05) })),
      recommendedActions: scored.length ? ['Validate the answer against the latest OEM revision before field execution.', 'Attach the cited document section to the service work order.'] : ['Upload OEM manuals, SOPs, or warranty terms and ask again.'],
      confidence: scored.length ? 0.68 : 0.35,
    };
    const ai = await postAgenticJson('/minecare-ai/knowledge/ask', { question, chunks: scored.map((item) => item.chunk) }, fallback);
    const citations = Array.isArray((ai as any).citations) && (ai as any).citations.length ? (ai as any).citations : fallback.citations;
    const sources = Array.isArray((ai as any).sources) && (ai as any).sources.length ? (ai as any).sources : citations.map((item: any, index: number) => ({ ...item, chunkIndex: item.chunkIndex ?? index + 1, snippet: item.snippet ?? fallback.sources[index]?.snippet ?? '', confidence: number(item.confidence, fallback.sources[index]?.confidence ?? (ai as any).confidence ?? fallback.confidence) }));
    return { ...(ai as any), citations, sources, recommendedActions: cleanStringArray((ai as any).recommendedActions).length ? cleanStringArray((ai as any).recommendedActions) : fallback.recommendedActions };
  },

  async listVendorSlas() {
    await seedMineCarePhase2SampleData();
    return MineCareVendorSla.find({ isDeleted: false }).sort({ updated: -1 }).lean();
  },
  async createVendorSla(payload: Record<string, unknown>) {
    await seedMineCarePhase2SampleData();
    return MineCareVendorSla.create({ slaId: text(payload.slaId, generatedId('SLA')), vendorName: text(payload.vendorName, 'Vendor'), contractType: text(payload.contractType, 'Service Contract'), equipmentIds: cleanStringArray(payload.equipmentIds), serviceFrequencyDays: number(payload.serviceFrequencyDays, 30), committedResponseHours: number(payload.committedResponseHours, 24), actualResponseHours: number(payload.actualResponseHours, 0), plannedServiceDate: dateFrom(payload.plannedServiceDate, addDays(30)), actualServiceDate: payload.actualServiceDate ? dateFrom(payload.actualServiceDate, now()) : undefined, missedServiceCount: number(payload.missedServiceCount, 0), slaCompliancePercent: number(payload.slaCompliancePercent, 100), penaltyAmount: number(payload.penaltyAmount, 0), status: text(payload.status, 'Active') as any, active: true, isDeleted: false, created: now(), updated: now() });
  },
  async getVendorSla(id: string) {
    await seedMineCarePhase2SampleData();
    return MineCareVendorSla.findOne(idFilter('slaId', id)).lean();
  },
  async updateVendorSla(id: string, payload: Record<string, unknown>) {
    const item = await MineCareVendorSla.findOne(idFilter('slaId', id));
    if (!item) return null;
    Object.assign(item, { vendorName: text(payload.vendorName, item.vendorName), contractType: text(payload.contractType, item.contractType), equipmentIds: payload.equipmentIds ? cleanStringArray(payload.equipmentIds) : item.equipmentIds, serviceFrequencyDays: number(payload.serviceFrequencyDays, item.serviceFrequencyDays), committedResponseHours: number(payload.committedResponseHours, item.committedResponseHours), actualResponseHours: number(payload.actualResponseHours, item.actualResponseHours), plannedServiceDate: payload.plannedServiceDate ? dateFrom(payload.plannedServiceDate, item.plannedServiceDate ?? now()) : item.plannedServiceDate, actualServiceDate: payload.actualServiceDate ? dateFrom(payload.actualServiceDate, item.actualServiceDate ?? now()) : item.actualServiceDate, missedServiceCount: number(payload.missedServiceCount, item.missedServiceCount), slaCompliancePercent: number(payload.slaCompliancePercent, item.slaCompliancePercent), penaltyAmount: number(payload.penaltyAmount, item.penaltyAmount), status: text(payload.status, item.status), updated: now() });
    await item.save();
    return item.toObject();
  },
  async deleteVendorSla(id: string) {
    const item = await MineCareVendorSla.findOneAndUpdate(idFilter('slaId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },
  async getVendorSlaScorecard() {
    const items = await this.listVendorSlas();
    return {
      totalVendors: new Set(items.map((item: any) => item.vendorName)).size,
      activeContracts: items.filter((item: any) => item.status === 'Active').length,
      atRiskContracts: items.filter((item: any) => item.status === 'At Risk' || item.status === 'Breached').length,
      totalPenaltyExposure: items.reduce((sum: number, item: any) => sum + item.penaltyAmount, 0),
      vendors: items.map((item: any) => ({ vendorName: item.vendorName, status: item.status, compliance: item.slaCompliancePercent, penaltyAmount: item.penaltyAmount, missedServiceCount: item.missedServiceCount })),
    };
  },

  async listRepairReplaceAnalyses() {
    await seedMineCarePhase2SampleData();
    return MineCareRepairReplaceAnalysis.find({ isDeleted: false }).sort({ updated: -1 }).lean();
  },
  async analyzeRepairReplace(payload: Record<string, unknown>) {
    const context = await loadMineCareContext();
    const fallback = deterministicRepairReplace(payload, context);
    const ai = await postAgenticJson('/minecare-ai/repair-replace/analyze', { ...payload, context: { equipment: context.equipment, breakdowns: context.breakdowns, riskRanking: calculateRiskRankingFromContext(context) } }, fallback);
    const item = await MineCareRepairReplaceAnalysis.create({ analysisId: generatedId('RR'), equipmentId: text((ai as any).equipmentId, fallback.equipmentId), equipmentName: text((ai as any).equipmentName, fallback.equipmentName), recommendation: text((ai as any).recommendation, fallback.recommendation), reason: text((ai as any).reason, fallback.reason), repairCostRatio: number((ai as any).repairCostRatio, fallback.repairCostRatio), estimatedReplacementYear: number((ai as any).estimatedReplacementYear, fallback.estimatedReplacementYear), financialImpact: (ai as any).financialImpact ?? fallback.financialImpact, recommendedActions: cleanStringArray((ai as any).recommendedActions).length ? cleanStringArray((ai as any).recommendedActions) : fallback.recommendedActions, decisionFactors: cleanStringArray((ai as any).decisionFactors).length ? cleanStringArray((ai as any).decisionFactors) : fallback.decisionFactors, paybackEstimate: text((ai as any).paybackEstimate, fallback.paybackEstimate), confidence: number((ai as any).confidence, fallback.confidence), active: true, isDeleted: false, created: now(), updated: now() });
    return item.toObject();
  },
  async getRepairReplaceAnalysis(id: string) {
    await seedMineCarePhase2SampleData();
    return MineCareRepairReplaceAnalysis.findOne(idFilter('analysisId', id)).lean();
  },
  async deleteRepairReplaceAnalysis(id: string) {
    const item = await MineCareRepairReplaceAnalysis.findOneAndUpdate(idFilter('analysisId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },

  async listDowntimeScenarios() {
    await seedMineCarePhase2SampleData();
    return MineCareDowntimeScenario.find({ isDeleted: false }).sort({ updated: -1 }).lean();
  },
  async simulateDowntime(payload: Record<string, unknown>) {
    const context = await loadMineCareContext();
    const equipment = findEquipment(context, text(payload.equipmentId)) ?? context.equipment[0];
    const expectedDowntimeHours = number(payload.expectedDowntimeHours, 8);
    const productionLossPerHour = number(payload.productionLossPerHour, 10000);
    const repairDelayDays = number(payload.repairDelayDays, 0);
    const productionLoss = Math.round((expectedDowntimeHours + repairDelayDays * 8) * productionLossPerHour);
    const riskLevel = productionLoss > 250000 ? 'Critical' : productionLoss > 100000 ? 'High' : 'Medium';
    const dependentProcesses = cleanStringArray(payload.dependentProcesses);
    const item = await MineCareDowntimeScenario.create({
      scenarioId: generatedId('DT'),
      equipmentId: equipment?.equipmentId ?? text(payload.equipmentId),
      equipmentName: equipment?.name ?? text(payload.equipmentName),
      expectedDowntimeHours,
      productionLossPerHour,
      dependentProcesses,
      failureProbability: number(payload.failureProbability, 0.2),
      repairDelayDays,
      productionLoss,
      riskLevel,
      recommendedAction: productionLoss > 100000 ? 'Pre-stage technician and critical spares before production impact escalates.' : 'Track scenario and align repair window with planned downtime.',
      recoveryPlan: [
        'Assign repair owner and confirm fault isolation window.',
        'Reserve required technician and critical spares before shutdown.',
        repairDelayDays > 0 ? 'Escalate vendor or procurement delay before production loss compounds.' : 'Align recovery with planned downtime window.',
      ],
      mitigationOptions: [
        dependentProcesses.length ? `Protect dependent process(es): ${dependentProcesses.join(', ')}.` : 'Identify downstream processes before work starts.',
        'Prepare temporary production reroute or alternate asset coverage.',
        'Review warranty and repair/replace exposure if downtime risk repeats.',
      ],
      impactExplanation: `${expectedDowntimeHours} downtime hour(s) plus ${repairDelayDays} delay day(s) creates ${productionLoss} estimated production loss.`,
      active: true,
      isDeleted: false,
      created: now(),
      updated: now(),
    });
    return enrichMineCareAi('downtime-simulator', item.toObject(), compactMineCareContext({
      ...context,
      equipment: equipment ? [equipment] : [],
      downtimeScenarios: [item.toObject()],
    }), 'Enhance recommendedAction, recoveryPlan, mitigationOptions, impactExplanation, and risk narrative. Preserve scenario ID, equipment ID, downtime hours, production loss, and status values.');
  },
  async getDowntimeScenario(id: string) {
    await seedMineCarePhase2SampleData();
    return MineCareDowntimeScenario.findOne(idFilter('scenarioId', id)).lean();
  },
  async deleteDowntimeScenario(id: string) {
    const item = await MineCareDowntimeScenario.findOneAndUpdate(idFilter('scenarioId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },

  async listTechnicians() {
    await seedMineCarePhase2SampleData();
    return MineCareTechnician.find({ isDeleted: false }).sort({ technicianName: 1 }).lean();
  },
  async createTechnician(payload: Record<string, unknown>) {
    await seedMineCarePhase2SampleData();
    return MineCareTechnician.create({ technicianId: text(payload.technicianId, generatedId('TECH')), technicianName: text(payload.technicianName, 'Technician'), employeeId: text(payload.employeeId, generatedId('EMP')), skills: cleanStringArray(payload.skills), equipmentTypes: cleanStringArray(payload.equipmentTypes), issueTypes: cleanStringArray(payload.issueTypes), availabilityStatus: text(payload.availabilityStatus, 'Available') as any, averageResolutionHours: number(payload.averageResolutionHours, 8), successRate: number(payload.successRate, 85), completedJobs: number(payload.completedJobs, 0), location: text(payload.location, 'Mine Site'), active: true, isDeleted: false, created: now(), updated: now() });
  },
  async getTechnician(id: string) {
    await seedMineCarePhase2SampleData();
    return MineCareTechnician.findOne(idFilter('technicianId', id)).lean();
  },
  async updateTechnician(id: string, payload: Record<string, unknown>) {
    const item = await MineCareTechnician.findOne(idFilter('technicianId', id));
    if (!item) return null;
    Object.assign(item, { technicianName: text(payload.technicianName, item.technicianName), employeeId: text(payload.employeeId, item.employeeId), skills: payload.skills ? cleanStringArray(payload.skills) : item.skills, equipmentTypes: payload.equipmentTypes ? cleanStringArray(payload.equipmentTypes) : item.equipmentTypes, issueTypes: payload.issueTypes ? cleanStringArray(payload.issueTypes) : item.issueTypes, availabilityStatus: text(payload.availabilityStatus, item.availabilityStatus), averageResolutionHours: number(payload.averageResolutionHours, item.averageResolutionHours), successRate: number(payload.successRate, item.successRate), completedJobs: number(payload.completedJobs, item.completedJobs), location: text(payload.location, item.location), updated: now() });
    await item.save();
    return item.toObject();
  },
  async deleteTechnician(id: string) {
    const item = await MineCareTechnician.findOneAndUpdate(idFilter('technicianId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },
  async recommendTechnician(payload: Record<string, unknown>) {
    await seedMineCarePhase2SampleData();
    const issueType = text(payload.issueType).toLowerCase();
    const equipmentType = text(payload.equipmentType).toLowerCase();
    const technicians = await MineCareTechnician.find({ isDeleted: false }).lean();
    const recommendations = technicians.map((item: any) => {
      const issueMatch = item.issueTypes.some((value: string) => value.toLowerCase().includes(issueType));
      const equipmentMatch = item.equipmentTypes.some((value: string) => value.toLowerCase().includes(equipmentType));
      const score = (item.availabilityStatus === 'Available' ? 30 : item.availabilityStatus === 'Busy' ? 10 : 0) + (issueMatch ? 25 : 0) + (equipmentMatch ? 25 : 0) + item.successRate * 0.2 - item.averageResolutionHours;
      const skillGap = [issueMatch ? '' : `Add ${text(payload.issueType)} issue experience`, equipmentMatch ? '' : `Add ${text(payload.equipmentType)} equipment coverage`].filter(Boolean);
      return {
        ...item,
        matchScore: Math.round(score),
        reason: `${item.availabilityStatus}; success ${item.successRate}%; average ${item.averageResolutionHours}h resolution.`,
        aiExplanation: `${item.technicianName} ranks with ${Math.round(score)} match score based on availability, issue fit, equipment fit, success rate, and average resolution time.`,
        skillGap,
        trainingSuggestion: skillGap.length ? `Cross-train on ${skillGap.join(' and ').toLowerCase()}.` : 'No immediate skill gap detected for this assignment.',
      };
    }).sort((left, right) => right.matchScore - left.matchScore);
    return enrichMineCareAi('workforce-recommendation', recommendations, { request: payload, technicians: technicians.slice(0, 25) }, 'Enhance aiExplanation, skillGap, trainingSuggestion, reason, and match confidence. Preserve technician IDs, availability, and roster facts.');
  },

  async listProcurementOptions() {
    await seedMineCarePhase2SampleData();
    return MineCareProcurementOption.find({ isDeleted: false }).sort({ updated: -1 }).lean();
  },
  async listProcurementComparisons() {
    await seedMineCarePhase2SampleData();
    return MineCareProcurementComparison.find({ isDeleted: false }).sort({ updated: -1 }).limit(20).lean();
  },
  async createProcurementOption(payload: Record<string, unknown>) {
    await seedMineCarePhase2SampleData();
    return MineCareProcurementOption.create({ optionId: text(payload.optionId, generatedId('PROC')), name: text(payload.name, 'Procurement Option'), equipmentType: text(payload.equipmentType, 'Equipment'), vendor: text(payload.vendor, 'Vendor'), purchaseCost: number(payload.purchaseCost, 0), warrantyYears: number(payload.warrantyYears, 1), expectedMaintenanceCost: number(payload.expectedMaintenanceCost, 0), fuelCost: number(payload.fuelCost, 0), expectedLifeYears: number(payload.expectedLifeYears, 5), resaleValue: number(payload.resaleValue, 0), downtimeRiskCost: number(payload.downtimeRiskCost, 0), notes: text(payload.notes), active: true, isDeleted: false, created: now(), updated: now() });
  },
  async getProcurementOption(id: string) {
    await seedMineCarePhase2SampleData();
    return MineCareProcurementOption.findOne(idFilter('optionId', id)).lean();
  },
  async updateProcurementOption(id: string, payload: Record<string, unknown>) {
    const item = await MineCareProcurementOption.findOne(idFilter('optionId', id));
    if (!item) return null;
    Object.assign(item, { name: text(payload.name, item.name), equipmentType: text(payload.equipmentType, item.equipmentType), vendor: text(payload.vendor, item.vendor), purchaseCost: number(payload.purchaseCost, item.purchaseCost), warrantyYears: number(payload.warrantyYears, item.warrantyYears), expectedMaintenanceCost: number(payload.expectedMaintenanceCost, item.expectedMaintenanceCost), fuelCost: number(payload.fuelCost, item.fuelCost), expectedLifeYears: number(payload.expectedLifeYears, item.expectedLifeYears), resaleValue: number(payload.resaleValue, item.resaleValue), downtimeRiskCost: number(payload.downtimeRiskCost, item.downtimeRiskCost), notes: text(payload.notes, item.notes), updated: now() });
    await item.save();
    return item.toObject();
  },
  async deleteProcurementOption(id: string) {
    const item = await MineCareProcurementOption.findOneAndUpdate(idFilter('optionId', id), { isDeleted: true, deletedAt: now(), active: false, updated: now() }, { new: true });
    return Boolean(item);
  },
  async compareProcurementOptions(payload: Record<string, unknown>) {
    await seedMineCarePhase2SampleData();
    const selectedOptionIds = cleanStringArray(payload.optionIds);
    const options = await MineCareProcurementOption.find(selectedOptionIds.length ? { optionId: { $in: selectedOptionIds }, isDeleted: false } : { isDeleted: false }).lean();
    const equipmentTypes = [...new Set(options.map((option: any) => text(option.equipmentType)).filter(Boolean))];
    if (options.length < 2) {
      throw new AppError('Select at least two procurement options to compare.', HTTP_STATUS.BAD_REQUEST);
    }
    if (equipmentTypes.length > 1) {
      throw new AppError(`Select options from one equipment type only. Current selection includes: ${equipmentTypes.join(', ')}.`, HTTP_STATUS.BAD_REQUEST);
    }
    const fallback = deterministicProcurementComparison(options);
    const ai = await postAgenticJson('/minecare-ai/procurement-options/compare', { options }, fallback);
    const item = await MineCareProcurementComparison.create({ comparisonId: generatedId('PCMP'), selectedOptionIds: options.map((option: any) => option.optionId), bestOption: text((ai as any).bestOption, fallback.bestOption), reason: text((ai as any).reason, fallback.reason), comparison: Array.isArray((ai as any).comparison) ? (ai as any).comparison : fallback.comparison, recommendedActions: cleanStringArray((ai as any).recommendedActions).length ? cleanStringArray((ai as any).recommendedActions) : fallback.recommendedActions, vendorRiskSummary: text((ai as any).vendorRiskSummary, fallback.vendorRiskSummary), negotiationPoints: cleanStringArray((ai as any).negotiationPoints).length ? cleanStringArray((ai as any).negotiationPoints) : fallback.negotiationPoints, decisionFactors: cleanStringArray((ai as any).decisionFactors).length ? cleanStringArray((ai as any).decisionFactors) : fallback.decisionFactors, confidence: number((ai as any).confidence, fallback.confidence), active: true, isDeleted: false, created: now(), updated: now() });
    return item.toObject();
  },
};
