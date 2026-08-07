const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

const US_STATE_CODES = new Set(Object.values(US_STATE_NAME_TO_CODE));

export const CLAIM_LIFECYCLE_STATUSES = [
  'DRAFT',
  'READY',
  'SUBMITTED',
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'FAILED',
] as const;

export type ClaimLifecycleStatus = (typeof CLAIM_LIFECYCLE_STATUSES)[number];

export const CLAIM_TRACKING_SOURCES = ['REAL', 'SIMULATED'] as const;
export type ClaimTrackingSource = (typeof CLAIM_TRACKING_SOURCES)[number];

export const CLAIM_RESPONSE_TYPES = [
  'SUBMISSION',
  'ACK_999',
  'ACK_277CA',
  'STATUS_UPDATE',
] as const;
export type ClaimResponseType = (typeof CLAIM_RESPONSE_TYPES)[number];

export const CLAIM_TRACKING_EVENT_TYPES = [
  'SUBMISSION_CREATED',
  'SUBMISSION_SENT',
  'SUBMISSION_FAILED',
  'ACK_999_ACCEPTED',
  'ACK_999_REJECTED',
  'ACK_277CA_ACCEPTED',
  'ACK_277CA_REJECTED',
  'CLAIM_PENDING',
  'CLAIM_STATUS_UPDATED',
] as const;
export type ClaimTrackingEventType = (typeof CLAIM_TRACKING_EVENT_TYPES)[number];

const ACCEPTED_STATUS_VALUES = new Set([
  'A',
  'ACCEPT',
  'ACCEPTED',
  'ACK',
  'ACKNOWLEDGED',
  'APPROVED',
  'A1',
  'A2',
]);

const REJECTED_STATUS_VALUES = new Set([
  'R',
  'REJECT',
  'REJECTED',
  'DENIED',
  'DENY',
  'FAILED',
  'FAILURE',
  'ERROR',
  'INVALID',
  'NOT ACCEPTED',
  'A3',
  'A6',
  'A7',
  'A8',
]);

const FAILED_STATUS_VALUES = new Set([
  'FAILED',
  'FAILURE',
  'ERROR',
  'TRANSPORT FAILED',
  'NOT CONFIGURED',
  'TIMEOUT',
]);

const SUBMITTED_STATUS_VALUES = new Set([
  'SUBMITTED',
  'TRANSMITTED',
  'SENT',
  'QUEUED',
  'PRINTED',
]);

const READY_STATUS_VALUES = new Set([
  'READY',
  'READY FOR SUBMISSION',
  'CLEAN',
  'PASSED',
  'APPROVED FOR SUBMISSION',
]);

const DRAFT_STATUS_VALUES = new Set([
  'DRAFT',
  'NOT SUBMITTED',
  'NEW',
]);

function normalizeStatusText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function normalizeClaimLifecycleStatus(value: unknown): ClaimLifecycleStatus {
  const normalizedValue = normalizeStatusText(value);

  if (!normalizedValue) {
    return 'PENDING';
  }

  if (CLAIM_LIFECYCLE_STATUSES.includes(normalizedValue as ClaimLifecycleStatus)) {
    return normalizedValue as ClaimLifecycleStatus;
  }

  const leadingCode = normalizedValue.split(/[:\s/|,-]+/)[0];

  if (FAILED_STATUS_VALUES.has(normalizedValue) || FAILED_STATUS_VALUES.has(leadingCode)) {
    return 'FAILED';
  }

  if (
    REJECTED_STATUS_VALUES.has(normalizedValue)
    || REJECTED_STATUS_VALUES.has(leadingCode)
    || /\b(REJECT|DENIED|INVALID|NOT ACCEPTED)\b/i.test(normalizedValue)
  ) {
    return 'REJECTED';
  }

  if (
    ACCEPTED_STATUS_VALUES.has(normalizedValue)
    || ACCEPTED_STATUS_VALUES.has(leadingCode)
    || /\b(ACCEPT|ACKNOWLEDGED|APPROVED)\b/i.test(normalizedValue)
  ) {
    return 'ACCEPTED';
  }

  if (SUBMITTED_STATUS_VALUES.has(normalizedValue) || SUBMITTED_STATUS_VALUES.has(leadingCode)) {
    return 'SUBMITTED';
  }

  if (READY_STATUS_VALUES.has(normalizedValue)) {
    return 'READY';
  }

  if (DRAFT_STATUS_VALUES.has(normalizedValue)) {
    return 'DRAFT';
  }

  return 'PENDING';
}

export function normalizeClaimTrackingSource(value: unknown): ClaimTrackingSource {
  return normalizeStatusText(value) === 'REAL' ? 'REAL' : 'SIMULATED';
}

export function normalizeClaimResponseType(value: unknown): ClaimResponseType {
  const normalizedValue = normalizeStatusText(value).replace(/\s+/g, '_');

  if (CLAIM_RESPONSE_TYPES.includes(normalizedValue as ClaimResponseType)) {
    return normalizedValue as ClaimResponseType;
  }

  if (normalizedValue.includes('999')) {
    return 'ACK_999';
  }

  if (normalizedValue.includes('277')) {
    return 'ACK_277CA';
  }

  if (normalizedValue.includes('STATUS')) {
    return 'STATUS_UPDATE';
  }

  return 'SUBMISSION';
}

export function normalizeUsState(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const upperValue = trimmed.replace(/\./g, '').toUpperCase();
  if (US_STATE_CODES.has(upperValue)) {
    return upperValue;
  }

  const normalizedName = trimmed
    .replace(/\./g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return US_STATE_NAME_TO_CODE[normalizedName] ?? upperValue;
}
