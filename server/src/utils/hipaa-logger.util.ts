import { envConfig } from '../config/env.config';

type RcmLogStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

type RcmLogInput = {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  module: string;
  eventType: string;
  status: RcmLogStatus;
  durationMs?: number;
  errorCode?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set(
  [
    'patientName',
    'firstName',
    'lastName',
    'dateOfBirth',
    'dob',
    'ssn',
    'memberId',
    'subscriberId',
    'subscriberNumber',
    'policyNumber',
    'address',
    'addressLine1',
    'addressLine2',
    'phone',
    'email',
    'x12',
    'x12Payload',
    'rawX12',
    'raw835Text',
    'raw835Payload',
    'rawEligibilityPayload',
    'rawPayload',
    'payloadSnapshot',
    'apiKey',
    'authorization',
    'secret',
    'token',
  ].map((key) => key.toLowerCase())
);

function redactString(value: string) {
  if (
    value.includes('ISA*')
    || value.includes('ST*837')
    || value.includes('ST*835')
    || value.includes('ST*277')
    || value.includes('ST*999')
    || value.includes('CLP*')
  ) {
    return '[REDACTED_X12]';
  }

  return value;
}

export function redactPhi(value: unknown): unknown {
  if (envConfig.rcmAllowPhiLogs) {
    return value;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPhi(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((nextValue, [key, item]) => {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      nextValue[key] = '[REDACTED]';
      return nextValue;
    }

    if (envConfig.rcmRedactDiagnosisCodes && (normalizedKey.includes('diagnosis') || normalizedKey === 'icdCodes')) {
      nextValue[key] = '[REDACTED]';
      return nextValue;
    }

    nextValue[key] = redactPhi(item);
    return nextValue;
  }, {});
}

export function createRcmLogTimer() {
  const startedAt = Date.now();
  return () => Date.now() - startedAt;
}

export function logRcmEvent(input: RcmLogInput) {
  const entry = {
    requestId: input.requestId,
    correlationId: input.correlationId,
    userId: input.userId,
    module: input.module,
    eventType: input.eventType,
    status: input.status,
    durationMs: input.durationMs,
    errorCode: input.errorCode,
    message: input.message,
    metadata: input.metadata ? redactPhi(input.metadata) : undefined,
    timestamp: new Date().toISOString(),
  };

  const logLine = JSON.stringify(entry);

  if (input.status === 'FAILED') {
    console.error(logLine);
    return;
  }

  console.info(logLine);
}
