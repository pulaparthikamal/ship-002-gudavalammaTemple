export interface SuggestedCode {
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  units?: number;
}

export interface CodeSuggestionResponse {
  status: string;
  suggestedCodes: SuggestedCode[];
  suggestedFixes: string[];
}

export interface RcmCodeValidationResult {
  code: string;
  codeType: string;
  status: string;
  reasoning: string;
  suggestedAlternative?: string;
}

export interface EncounterCodeSuggestionResponse {
  status: string;
  diagnosisCodes: SuggestedCode[];
  procedureCodes: SuggestedCode[];
  validationResults: RcmCodeValidationResult[];
  suggestedFixes: string[];
  summary?: string;
}

export interface EncounterCodingVitalsContext {
  temperature?: number;
  bloodPressure?: string;
  pulse?: number;
  height?: number;
  weight?: number;
  bmi?: number;
}

export interface ProcedureReferenceContextItem {
  code: string;
  description?: string;
  placeOfService?: string;
  defaultChargeAmount?: number;
  modifiersAllowed?: string[];
  diagnosisRestrictions?: string[];
}

export interface EncounterCodeSuggestionRequest {
  encounterNote: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  clinicalNotes?: string;
  appointmentType?: string;
  visitType?: string;
  appointmentReason?: string;
  appointmentNotes?: string;
  serviceDate?: string;
  patientAge?: number;
  patientGender?: string;
  patientSex?: string;
  providerSpecialty?: string;
  providerCredentials?: string;
  providerType?: string;
  facilityName?: string;
  placeOfServiceCode?: string;
  vitals?: EncounterCodingVitalsContext;
  procedureReferenceContext?: ProcedureReferenceContextItem[];
  existingDiagnosisCodes?: string[];
  existingProcedureCodes?: string[];
}

export interface DenialPredictionResponse {
  status: string;
  denialProbability: number;
  potentialRejectionReasons: string[];
  recommendedActions: string[];
}

export interface AuthPredictionResponse {
  status: string;
  requiresAuth: boolean;
  confidence: number;
  ruleSource: string;
}

export interface DependentValidationResponse {
  status: string;
  riskScore: number;
  issues: string[];
  suggestedFixes: string[];
  source: string;
}

export interface CodingReviewFailureIssue {
  lineNumber?: number;
  field: string;
  title: string;
  explanation: string;
  correction: string;
  source: string;
}

export interface CodingReviewFailureExplanationResponse {
  status: string;
  summary?: string;
  issues: CodingReviewFailureIssue[];
  suggestedFixes: string[];
}

export interface AckRejectionAnalysisResponse {
  status: string;
  rootCause: string;
  correctionType: string;
  affectedFields: string[];
  recommendedActions: string[];
  correctedClaimRecommended: boolean;
  priority: string;
  confidence: number;
  source: string;
}

export interface DenialAnalysisResponse {
  status: string;
  rootCause: string;
  recommendation: string;
  recommendationReason: string;
  evidenceNeeded: string[];
  missingDocumentation: string[];
  payerPolicyNotes: string[];
  nextBestAction: string;
  confidence: number;
  source: string;
}

export interface AppealPacketResponse {
  status: string;
  appealLetterDraft: string;
  evidenceChecklist: string[];
  medicalNecessityArgument?: string;
  payerSpecificArgument?: string;
  missingDocs: string[];
  overturnProbability: number;
  confidence: number;
  source: string;
}

export interface EraMatchExceptionExplanationResponse {
  status: string;
  explanation: string;
  likelyMatch: Record<string, unknown>;
  ambiguityReasons: string[];
  recommendedActions: string[];
  confidence: number;
  source: string;
}

export interface ArPrioritizationResponse {
  status: string;
  priority: string;
  financialImpact: number;
  slaRisk: string;
  recommendedOwnerQueue: string;
  nextAction: string;
  reason: string;
  confidence: number;
  source: string;
}

const AGENTIC_SERVER_URL = process.env.AGENTIC_SERVER_URL || 'http://localhost:8007';
const AGENTIC_SERVER_API_URL = /\/api\/v\d+$/i.test(AGENTIC_SERVER_URL.replace(/\/$/, ''))
  ? AGENTIC_SERVER_URL.replace(/\/$/, '')
  : `${AGENTIC_SERVER_URL.replace(/\/$/, '')}/api/v1`;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 300_000;
const AGENTIC_SERVER_API_KEY = process.env.AGENTIC_SERVER_API_KEY || 'change-me-shared-rcm-ai-key';
const RCM_AI_PROVIDER = (process.env.RCM_AI_PROVIDER || 'auto').trim().toLowerCase();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';

function resolveTimeoutMs(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return fallback;
}

const AI_REQUEST_TIMEOUT_MS = resolveTimeoutMs(
  process.env.AGENTIC_SERVER_TIMEOUT_MS,
  DEFAULT_AI_REQUEST_TIMEOUT_MS
);
const OLLAMA_TIMEOUT_MS = resolveTimeoutMs(process.env.OLLAMA_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS);

const DIAGNOSIS_CODE_PATTERN = /^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$/i;
const PROCEDURE_CODE_PATTERN = /^(?:\d{5}|[A-Z]\d{4})$/i;

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeConfidence(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? Math.max(0, Math.min(1, parsedValue)) : 0;
  }

  return 0;
}

function normalizeUnits(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
  }

  return undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCodeValue(value: unknown) {
  return normalizeText(value)?.toUpperCase();
}

function isDiagnosisCode(code: string) {
  return DIAGNOSIS_CODE_PATTERN.test(code);
}

function isProcedureCode(code: string) {
  return PROCEDURE_CODE_PATTERN.test(code);
}

function normalizeSuggestedCode(value: unknown): SuggestedCode | null {
  if (typeof value === 'string') {
    const normalizedCode = normalizeCodeValue(value);

    if (!normalizedCode) {
      return null;
    }

    return {
      code: normalizedCode,
      description: '',
      confidence: 0,
      reasoning: '',
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const normalizedCode = normalizeCodeValue(
    value.code
    ?? value.icdCode
    ?? value.icd10Code
    ?? value.diagnosisCode
    ?? value.cptCode
    ?? value.hcpcsCode
    ?? value.procedureCode
    ?? value.value
  );

  if (!normalizedCode) {
    return null;
  }

  const units = normalizeUnits(value.units);

  return {
    code: normalizedCode,
    description: normalizeText(value.description ?? value.label ?? value.name ?? value.title) ?? '',
    confidence: normalizeConfidence(value.confidence ?? value.score),
    reasoning: normalizeText(value.reasoning ?? value.rationale ?? value.justification ?? value.notes) ?? '',
    ...(units ? { units } : {}),
  };
}

function normalizeSuggestedCodeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSuggestedCode(item))
    .filter((item): item is SuggestedCode => Boolean(item));
}

function collectResponseRoots(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  const roots: Record<string, unknown>[] = [payload];

  ['data', 'result', 'response', 'suggestions'].forEach((key) => {
    const candidate = payload[key];

    if (isRecord(candidate)) {
      roots.push(candidate);
    }
  });

  return roots;
}

function upsertSuggestion(map: Map<string, SuggestedCode>, suggestion: SuggestedCode) {
  const existingSuggestion = map.get(suggestion.code);

  if (!existingSuggestion || suggestion.confidence >= existingSuggestion.confidence) {
    map.set(suggestion.code, suggestion);
  }
}

function collectSuggestedFixes(roots: Record<string, unknown>[]) {
  const values = new Set<string>();

  roots.forEach((root) => {
    [
      ...normalizeStringArray(root.suggestedFixes),
      ...normalizeStringArray(root.recommendedActions),
      ...normalizeStringArray(root.fixes),
      ...normalizeStringArray(root.nextActions),
    ].forEach((value) => values.add(value));
  });

  return Array.from(values);
}

function extractSummary(roots: Record<string, unknown>[]) {
  for (const root of roots) {
    const summary = normalizeText(root.summary ?? root.message ?? root.overview);

    if (summary) {
      return summary;
    }
  }

  return undefined;
}

function extractStatus(roots: Record<string, unknown>[]) {
  for (const root of roots) {
    const status = normalizeText(root.status ?? root.resultStatus ?? root.outcome);

    if (status) {
      return status;
    }
  }

  return 'success';
}

function normalizeEncounterCodeSuggestionResponse(payload: unknown): EncounterCodeSuggestionResponse {
  const roots = collectResponseRoots(payload);
  const diagnosisCodes = new Map<string, SuggestedCode>();
  const procedureCodes = new Map<string, SuggestedCode>();
  const validationResults: RcmCodeValidationResult[] = [];

  roots.forEach((root) => {
    normalizeSuggestedCodeList(
      root.diagnosisCodes
      ?? root.suggestedDiagnosisCodes
      ?? root.icdCodes
      ?? root.icd10Codes
    ).forEach((suggestion) => upsertSuggestion(diagnosisCodes, suggestion));

    [
      root.procedureCodes,
      root.suggestedProcedureCodes,
      root.cptCodes,
      root.hcpcsCodes,
      root.cdtCodes,
      root.dentalCodes,
      root.dentalProcedureCodes,
    ].forEach((value) => {
      normalizeSuggestedCodeList(value).forEach((suggestion) => upsertSuggestion(procedureCodes, suggestion));
    });

    normalizeSuggestedCodeList(root.suggestedCodes ?? root.codes ?? root.codeSuggestions).forEach((suggestion) => {
      if (isDiagnosisCode(suggestion.code)) {
        upsertSuggestion(diagnosisCodes, suggestion);
        return;
      }

      if (isProcedureCode(suggestion.code)) {
        upsertSuggestion(procedureCodes, suggestion);
      }
    });

    const rootValidationResults = root.validationResults;
    if (Array.isArray(rootValidationResults)) {
      rootValidationResults.forEach((result: any) => {
        if (result && result.code) {
          validationResults.push({
            code: String(result.code),
            codeType: String(result.codeType || ''),
            status: String(result.status || ''),
            reasoning: String(result.reasoning || ''),
            suggestedAlternative: result.suggestedAlternative ? String(result.suggestedAlternative) : undefined,
          });
        }
      });
    }
  });

  return {
    status: extractStatus(roots),
    diagnosisCodes: Array.from(diagnosisCodes.values()),
    procedureCodes: Array.from(procedureCodes.values()),
    validationResults,
    suggestedFixes: collectSuggestedFixes(roots),
    summary: extractSummary(roots),
  };
}

function normalizeCodingReviewFailureIssue(value: unknown): CodingReviewFailureIssue | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = normalizeText(value.title);
  const explanation = normalizeText(value.explanation ?? value.reason);
  const correction = normalizeText(value.correction ?? value.recommendedCorrection ?? value.action);

  if (!title || !explanation || !correction) {
    return null;
  }

  const rawLineNumber = value.lineNumber ?? value.line_number;
  const lineNumber =
    typeof rawLineNumber === 'number' && Number.isFinite(rawLineNumber) && rawLineNumber > 0
      ? rawLineNumber
      : undefined;

  return {
    ...(lineNumber ? { lineNumber } : {}),
    field: normalizeText(value.field ?? value.category ?? value.affectedField) ?? 'Coding review',
    title,
    explanation,
    correction,
    source: normalizeText(value.source ?? value.sourceError) ?? title,
  };
}

function normalizeCodingReviewFailureExplanationResponse(payload: unknown): CodingReviewFailureExplanationResponse {
  const roots = collectResponseRoots(payload);
  const issues = new Map<string, CodingReviewFailureIssue>();
  let summary: string | undefined;
  let status = 'success';

  roots.forEach((root) => {
    if (!summary) {
      summary = normalizeText(root.summary);
    }

    const rootStatus = normalizeText(root.status);
    if (rootStatus) {
      status = rootStatus;
    }

    const entries = [
      ...(Array.isArray(root.issues) ? root.issues : []),
      ...(Array.isArray(root.failureIssues) ? root.failureIssues : []),
    ];

    entries.forEach((entry) => {
      const issue = normalizeCodingReviewFailureIssue(entry);
      if (!issue) {
        return;
      }

      const key = `${issue.lineNumber ?? 'global'}|${issue.field}|${issue.title}`;
      issues.set(key, issue);
    });
  });

  return {
    status,
    summary,
    issues: Array.from(issues.values()),
    suggestedFixes: collectSuggestedFixes(roots),
  };
}

function hasEncounterSuggestions(response: EncounterCodeSuggestionResponse) {
  return response.diagnosisCodes.length > 0 || response.procedureCodes.length > 0;
}

function stripMarkdownCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function stripThinkBlocks(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractJsonObject(value: string) {
  const sanitizedValue = stripMarkdownCodeFence(stripThinkBlocks(value));

  try {
    return JSON.parse(sanitizedValue) as unknown;
  } catch (error) {
    const firstBraceIndex = sanitizedValue.indexOf('{');
    const lastBraceIndex = sanitizedValue.lastIndexOf('}');

    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      return JSON.parse(sanitizedValue.slice(firstBraceIndex, lastBraceIndex + 1)) as unknown;
    }

    throw error;
  }
}

async function postJson<T>(url: string, payload: unknown, options?: {
  apiKeyHeader?: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs;
  const requestTimeoutMs = Number.isFinite(timeoutMs)
    ? Number(timeoutMs)
    : Number.isFinite(AI_REQUEST_TIMEOUT_MS)
      ? AI_REQUEST_TIMEOUT_MS
      : DEFAULT_AI_REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(
    () => controller.abort(),
    requestTimeoutMs
  );

  try {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.apiKeyHeader && options.apiKey ? { [options.apiKeyHeader]: options.apiKey } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new Error(`RCM AI request timed out after ${requestTimeoutMs}ms`);
      }

      throw error;
    }

    if (!response.ok) {
      throw new Error(`RCM AI request failed with status ${response.status}`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAgenticEncounterSuggestions(payload: EncounterCodeSuggestionRequest) {
  const response = await postJson<unknown>(`${AGENTIC_SERVER_API_URL}/rcm/suggest-codes`, {
    encounterNote: payload.encounterNote,
    clinicalNotes: payload.clinicalNotes ?? payload.encounterNote,
    appointmentType: payload.appointmentType,
    visitType: payload.visitType,
    appointmentReason: payload.appointmentReason,
    appointmentNotes: payload.appointmentNotes,
    serviceDate: payload.serviceDate,
    patientAge: payload.patientAge,
    patientGender: payload.patientGender,
    patientSex: payload.patientSex,
    chiefComplaint: payload.chiefComplaint,
    historyOfPresentIllness: payload.historyOfPresentIllness,
    providerSpecialty: payload.providerSpecialty,
    providerCredentials: payload.providerCredentials,
    providerType: payload.providerType,
    facilityName: payload.facilityName,
    placeOfServiceCode: payload.placeOfServiceCode,
    vitals: payload.vitals,
    procedureReferenceContext: payload.procedureReferenceContext ?? [],
    existingDiagnosisCodes: payload.existingDiagnosisCodes ?? [],
    existingProcedureCodes: payload.existingProcedureCodes ?? [],
    existingCodes: [
      ...(payload.existingDiagnosisCodes ?? []),
      ...(payload.existingProcedureCodes ?? []),
    ],
    requestedCodeTypes: ['diagnosis', 'procedure'],
  }, {
    apiKeyHeader: 'x-agentic-api-key',
    apiKey: AGENTIC_SERVER_API_KEY,
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });

  return normalizeEncounterCodeSuggestionResponse(response);
}

function buildOllamaEncounterPrompt(payload: EncounterCodeSuggestionRequest) {
  return [
    'You are an expert outpatient medical coding assistant for a revenue cycle management application.',
    'Read the encounter documentation and structured encounter context, then infer supportable outpatient ICD-10-CM diagnosis codes and Charge Master procedure codes, including CPT, HCPCS, and dental CDT codes.',
    'In addition to suggesting new codes, you MUST evaluate each code already present in existingDiagnosisCodes and existingProcedureCodes.',
    'Return only strict JSON with this exact shape:',
    '{"status":"success","summary":"...","diagnosisCodes":[{"code":"...","description":"...","confidence":0.0,"reasoning":"..."}],"procedureCodes":[{"code":"...","description":"...","confidence":0.0,"reasoning":"...","units":1}],"validationResults":[{"code":"...","codeType":"diagnosis|procedure","status":"Valid|Invalid|Optimization Suggested","reasoning":"...","suggestedAlternative":"..."}],"suggestedFixes":["..."]}',
    'Rules:',
    '- Clinical Notes are the source of truth. Use chief complaint, HPI, appointment context, and vitals only as supporting context when they do not conflict with Clinical Notes.',
    '- If Clinical Notes conflict with structured context, follow Clinical Notes and mention the conflict in suggestedFixes if it affects coding.',
    '- Do not restate or rely on a patient status, visit type, or service level unless it appears in Clinical Notes or is directly supported there.',
    '- Only include codes directly supported by the documentation. Do not guess, upcode, or infer undocumented conditions or services.',
    '- Use diagnosisRestrictions as an allowed set only. Do not include a diagnosis merely because it is configured on a Charge Master entry.',
    '- Include every separately documented diagnosis, symptom, or condition that is clinically relevant to the selected procedure and is present in diagnosisRestrictions. Do not collapse a documented symptom into the underlying condition when both are separately documented and both are allowed.',
    '- Do not add a nonspecific symptom diagnosis when the documentation provides a more specific definitive dental condition that explains the symptom, such as abscess, periapical disease, pulp disease, caries, or infection. Only add the symptom diagnosis when documentation supports it as a separate billable diagnosis.',
    '- Do not select routine, normal, or no-abnormal-finding examination diagnoses when Clinical Notes document abnormal findings, active problems, symptoms, or disease. Select the abnormal/problem examination diagnosis when it is available and supported.',
    '- Treat Charge Master Entries as the complete selectable catalog. Review every entry in that catalog before deciding.',
    '- Your job is selection from Charge Master, not open-ended code generation.',
    '- If the note documents the same service using different wording than the Charge Master description, select the supported Charge Master entry and explain the evidence.',
    '- When multiple Charge Master entries could apply to the same service family, select the entry whose qualifiers most specifically match Clinical Notes, such as established, new, recall, periodic, comprehensive, limited, emergency, adult, child, image count, tooth number, or surface.',
    '- Do not select a broader or higher-intensity Charge Master entry when a narrower active entry is directly supported by Clinical Notes.',
    '- For dental radiographs, match the documented image type and count exactly. Do not select a complete series/full-mouth radiographic code unless Clinical Notes explicitly document a complete series, full mouth series, FMX, or equivalent full-series imaging. A single periapical radiograph must use the active periapical Charge Master entry, not a complete series entry.',
    '- For each suggested procedure code, include an exact short phrase from Clinical Notes in reasoning that supports the selected Charge Master entry.',
    '- Evaluate all codes in Existing Diagnosis Codes and Existing Procedure Codes. Mark them as Valid (supported), Invalid (not supported/contradicted), or Optimization Suggested (better code exists).',
    '- For validationResults, include every code from Existing Diagnosis Codes and Existing Procedure Codes.',
    '- validationResults is only for codes already present in existingDiagnosisCodes and existingProcedureCodes.',
    '- Do not place new recommendations only in validationResults. If a code is recommended for this encounter, it must also appear in diagnosisCodes or procedureCodes.',
    '- Suggest only additional codes that are not already present in Existing Diagnosis Codes or Existing Procedure Codes.',
    '- Never repeat an existing code in the diagnosisCodes or procedureCodes lists.',
    '- Keep diagnosisCodes focused on ICD-10-CM and procedureCodes focused on Charge Master procedure codes, including CPT, HCPCS, and dental CDT codes.',
    '- Dental CDT codes such as D0120, D0274, D1110, D1120, and D1206 are valid procedure codes when they appear in Charge Master Entries and are supported by Clinical Notes.',
    '- Put every procedure suggestion, including dental CDT codes, in the procedureCodes array. Do not use cdtCodes, dentalCodes, or separate dental procedure arrays.',
    '- If Charge Master Entries are provided, choose procedureCodes only from that list.',
    '- Use Charge Master entry descriptions as the source of truth for procedure descriptions.',
    '- If Charge Master Entries include diagnosisRestrictions, choose diagnosisCodes only from diagnosisRestrictions attached to selected procedure entries.',
    '- Do not invent procedure codes, diagnosis codes, or descriptions outside the provided Charge Master context.',
    '- If no Charge Master entry matches the documentation, return an empty list for that section and explain what setup or documentation is missing.',
    '- For E/M procedure suggestions, require documented support for time or medical decision making. Do not infer higher-level E/M codes from chronic conditions, vitals, or telehealth status alone.',
    '- Prefer a conservative list of higher-confidence codes over speculative codes.',
    '- Return every directly supported code from the provided Charge Master context. Return none when documentation does not support a candidate.',
    '- Use uppercase code values.',
    '- If evidence is weak or incomplete, return fewer codes, lower the confidence, and add specific suggestedFixes describing what documentation is missing.',
    '- Do not mention procedure or diagnosis code values in suggestedFixes unless that exact code is already present in diagnosisCodes, procedureCodes, existingDiagnosisCodes, existingProcedureCodes, or validationResults. Describe missing documentation or Charge Master setup gaps in words instead.',
    '- Do not include markdown, prose, or code fences.',
    '',
    `Service Date: ${payload.serviceDate ?? ''}`,
    `Appointment Type: ${payload.appointmentType ?? ''}`,
    `Visit Type: ${payload.visitType ?? ''}`,
    `Appointment Reason: ${payload.appointmentReason ?? ''}`,
    `Appointment Notes: ${payload.appointmentNotes ?? ''}`,
    `Patient Age: ${payload.patientAge ?? ''}`,
    `Patient Gender: ${payload.patientGender ?? ''}`,
    `Patient Sex: ${payload.patientSex ?? ''}`,
    `Provider Specialty: ${payload.providerSpecialty ?? ''}`,
    `Provider Credentials: ${payload.providerCredentials ?? ''}`,
    `Provider Type: ${payload.providerType ?? ''}`,
    `Facility Name: ${payload.facilityName ?? ''}`,
    `Place Of Service: ${payload.placeOfServiceCode ?? ''}`,
    `Chief Complaint: ${payload.chiefComplaint ?? ''}`,
    `History Of Present Illness: ${payload.historyOfPresentIllness ?? ''}`,
    `Clinical Notes: ${payload.clinicalNotes ?? payload.encounterNote}`,
    `Vitals: BP ${payload.vitals?.bloodPressure ?? ''}; Pulse ${payload.vitals?.pulse ?? ''}; Temp ${payload.vitals?.temperature ?? ''}; Height ${payload.vitals?.height ?? ''}; Weight ${payload.vitals?.weight ?? ''}; BMI ${payload.vitals?.bmi ?? ''}`,
    `Charge Master Entries: ${JSON.stringify(payload.procedureReferenceContext ?? [])}`,
    `Existing Diagnosis Codes: ${(payload.existingDiagnosisCodes ?? []).join(', ') || 'None'}`,
    `Existing Procedure Codes: ${(payload.existingProcedureCodes ?? []).join(', ') || 'None'}`,
  ].join('\n');
}

async function fetchOllamaEncounterSuggestions(payload: EncounterCodeSuggestionRequest) {
  const response = await postJson<Record<string, unknown>>(`${OLLAMA_BASE_URL}/api/chat`, {
    model: OLLAMA_MODEL,
    stream: false,
    format: 'json',
    options: {
      temperature: 0.1,
    },
    messages: [
      {
        role: 'system',
        content: 'You convert outpatient encounter documentation into structured ICD-10-CM and Charge Master procedure suggestions, including CPT, HCPCS, and dental CDT codes.',
      },
      {
        role: 'user',
        content: buildOllamaEncounterPrompt(payload),
      },
    ],
  }, {
    timeoutMs: OLLAMA_TIMEOUT_MS,
  });

  const message = isRecord(response.message) ? response.message : undefined;
  const content = normalizeText(message?.content ?? response.response);

  if (!content) {
    throw new Error('Ollama response did not include any structured content.');
  }

  return normalizeEncounterCodeSuggestionResponse(extractJsonObject(content));
}

export const rcmAiService = {
  async suggestEncounterCodes(payload: EncounterCodeSuggestionRequest): Promise<EncounterCodeSuggestionResponse> {
    const emptyResponse: EncounterCodeSuggestionResponse = {
      status: 'error',
      diagnosisCodes: [],
      procedureCodes: [],
      validationResults: [],
      suggestedFixes: [],
    };

    if (RCM_AI_PROVIDER === 'ollama') {
      try {
        return await fetchOllamaEncounterSuggestions(payload);
      } catch (error) {
        console.error('RCM AI Suggest Encounter Codes via Ollama failed:', error);
        throw error;
      }
    }

    let agenticResponse = emptyResponse;

    try {
      agenticResponse = await fetchAgenticEncounterSuggestions(payload);

      if (RCM_AI_PROVIDER === 'agentic' || hasEncounterSuggestions(agenticResponse)) {
        return agenticResponse;
      }
    } catch (error) {
      console.error('RCM AI Suggest Encounter Codes via Agentic server failed:', error);

      if (RCM_AI_PROVIDER === 'agentic') {
        throw error;
      }
    }

    try {
      const ollamaResponse = await fetchOllamaEncounterSuggestions(payload);
      return hasEncounterSuggestions(ollamaResponse) ? ollamaResponse : agenticResponse;
    } catch (error) {
      console.error('RCM AI Suggest Encounter Codes via Ollama fallback failed:', error);
      return hasEncounterSuggestions(agenticResponse) ? agenticResponse : emptyResponse;
    }
  },

  async suggestCodes(encounterNote: string, existingCodes: string[] = []): Promise<CodeSuggestionResponse> {
    try {
      return await postJson<CodeSuggestionResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/suggest-codes`,
        { encounterNote, existingCodes },
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Suggest Codes failed:', error);
      return { status: 'error', suggestedCodes: [], suggestedFixes: [] };
    }
  },

  async predictDenial(claimData: any, payerId: string): Promise<DenialPredictionResponse> {
    try {
      return await postJson<DenialPredictionResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/predict-denial`,
        { claimData, payerId },
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Predict Denial failed:', error);
      return {
        status: 'error',
        denialProbability: 1,
        potentialRejectionReasons: ['AI denial-risk service unavailable. Manual review is required before relying on AI risk scoring.'],
        recommendedActions: ['Review deterministic readiness, eligibility, authorization, payer rules, and coding manually because AI denial prediction failed.']
      };
    }
  },

  async analyzeAckRejection(payload: any): Promise<AckRejectionAnalysisResponse> {
    try {
      return await postJson<AckRejectionAnalysisResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/analyze-ack-rejection`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Analyze ACK Rejection failed:', error);
      return {
        status: 'fallback',
        rootCause: 'Unable to generate AI rejection analysis. Review acknowledgement error details manually.',
        correctionType: 'MANUAL_REVIEW',
        affectedFields: [],
        recommendedActions: ['Review acknowledgement status, correct the claim, rerun readiness, and resubmit.'],
        correctedClaimRecommended: true,
        priority: 'MEDIUM',
        confidence: 0,
        source: 'local-fallback',
      };
    }
  },

  async analyzeDenial(payload: any): Promise<DenialAnalysisResponse> {
    try {
      return await postJson<DenialAnalysisResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/analyze-denial`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Analyze Denial failed:', error);
      return {
        status: 'fallback',
        rootCause: 'Unable to generate AI denial analysis.',
        recommendation: 'MANUAL_REVIEW',
        recommendationReason: 'Agentic denial analysis was unavailable.',
        evidenceNeeded: [],
        missingDocumentation: [],
        payerPolicyNotes: [],
        nextBestAction: 'Assign denial for manual review.',
        confidence: 0,
        source: 'local-fallback',
      };
    }
  },

  async generateAppealPacket(payload: any): Promise<AppealPacketResponse> {
    try {
      return await postJson<AppealPacketResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/generate-appeal-packet`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Generate Appeal Packet failed:', error);
      return {
        status: 'fallback',
        appealLetterDraft: 'AI appeal packet generation was unavailable. Operator must draft appeal from claim, denial, ERA, and clinical evidence.',
        evidenceChecklist: ['Claim', 'ERA denial', 'Clinical documentation'],
        missingDocs: [],
        overturnProbability: 0,
        confidence: 0,
        source: 'local-fallback',
      };
    }
  },

  async explainEraMatchException(payload: any): Promise<EraMatchExceptionExplanationResponse> {
    try {
      return await postJson<EraMatchExceptionExplanationResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/explain-era-match-exception`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Explain ERA Match Exception failed:', error);
      return {
        status: 'fallback',
        explanation: 'AI ERA exception explanation was unavailable.',
        likelyMatch: {},
        ambiguityReasons: ['Manual ERA exception review required.'],
        recommendedActions: ['Validate claim/control numbers, service lines, payment trace, and idempotency before reprocessing.'],
        confidence: 0,
        source: 'local-fallback',
      };
    }
  },

  async prioritizeArWork(payload: any): Promise<ArPrioritizationResponse> {
    try {
      return await postJson<ArPrioritizationResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/prioritize-ar-work`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Prioritize AR Work failed:', error);
      return {
        status: 'fallback',
        priority: 'NORMAL',
        financialImpact: 0,
        slaRisk: 'UNKNOWN',
        recommendedOwnerQueue: 'AR_FOLLOW_UP',
        nextAction: 'Review AR work item manually.',
        reason: 'Agentic AR prioritization was unavailable.',
        confidence: 0,
        source: 'local-fallback',
      };
    }
  },

  async predictAuth(cptCode: string, payerId: string, diagnosisCodes: string[] = []): Promise<AuthPredictionResponse> {
    try {
      return await postJson<AuthPredictionResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/predict-auth`,
        { cptCode, payerId, diagnosisCodes },
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Predict Auth failed:', error);
      return {
        status: 'error',
        requiresAuth: true,
        confidence: 0,
        ruleSource: 'AI_UNAVAILABLE_MANUAL_REVIEW'
      };
    }
  },

  async validateDependentSubscriber(payload: any): Promise<DependentValidationResponse> {
    try {
      return await postJson<DependentValidationResponse>(
        `${AGENTIC_SERVER_API_URL}/rcm/validate-dependent-subscriber`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      console.error('RCM AI Dependent/Subscriber validation failed:', error);
      return {
        status: 'fallback',
        riskScore: 0,
        issues: [],
        suggestedFixes: [],
        source: 'local-fallback',
      };
    }
  },

  async explainCodingReviewFailure(payload: any): Promise<CodingReviewFailureExplanationResponse> {
    try {
      const response = await postJson<unknown>(
        `${AGENTIC_SERVER_API_URL}/rcm/explain-coding-review-failure`,
        payload,
        {
          apiKeyHeader: 'x-agentic-api-key',
          apiKey: AGENTIC_SERVER_API_KEY,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        }
      );

      return normalizeCodingReviewFailureExplanationResponse(response);
    } catch (error) {
      console.error('RCM AI Coding Review Failure Explanation failed:', error);
      return {
        status: 'error',
        issues: [],
        suggestedFixes: [],
      };
    }
  },
};
