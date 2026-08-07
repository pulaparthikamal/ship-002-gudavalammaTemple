import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import {
  claimSubmissionIntegrationConfig,
  isClaimSubmissionIntegrationConfigured,
} from './claim-submission.integration.config';

export type ClaimTransportEnvelope = {
  claimId: string;
  batchId: string;
  submissionTraceId: string;
  idempotencyKey: string;
  fileType: string;
  payload: string;
  metadata: Record<string, unknown>;
};

export type ClaimTransportResponse = {
  externalSubmissionId?: string;
  externalBatchId?: string;
  claimControlNumber?: string;
  clearinghouseTraceNumber?: string;
  payerClaimNumber?: string;
  transmissionStatus: string;
  acknowledgementStatus?: string;
  responseStatusCode: number;
  requestPayload: string;
  responsePayload: string;
};

export type ClaimStatusTransportResponse = {
  externalSubmissionId?: string;
  claimControlNumber?: string;
  clearinghouseTraceNumber?: string;
  payerClaimNumber?: string;
  transmissionStatus: 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  acknowledgementStatus?: string;
  responseStatusCode: number;
  requestPayload: string;
  responsePayload: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: TokenCache | null = null;

function isStediSubmissionTarget() {
  const vendorName = claimSubmissionIntegrationConfig.vendorName.trim().toLowerCase();
  const submitUrl = claimSubmissionIntegrationConfig.request.submitUrl.trim().toLowerCase();

  return vendorName === 'stedi' || submitUrl.includes('stedi.com');
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function readFirstPath(source: unknown, paths: readonly string[]) {
  for (const path of paths) {
    const value = readPath(source, path);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function coerceString(value: unknown) {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function serializePayload(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      message: 'Unable to serialize payload',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function redactTransportPayload(value: unknown): unknown {
  const sensitiveKeys = new Set(
    [
      'authorization',
      'apiKey',
      'api_key',
      'content',
      'x12',
      'payload',
      'ediPayload',
      'memberId',
      'member_id',
      'subscriberId',
      'firstName',
      'lastName',
      'dateOfBirth',
      'dob',
      'address',
      'phone',
      'patientMedicalRecordNumber',
    ].map((key) => key.toLowerCase())
  );

  if (typeof value === 'string') {
    return value.includes('ISA*') || value.includes('NM1*')
      ? '[REDACTED_X12_PAYLOAD]'
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTransportPayload(item));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (nextValue, [key, item]) => {
      if (sensitiveKeys.has(key.toLowerCase())) {
        nextValue[key] = '[REDACTED]';
        return nextValue;
      }

      nextValue[key] = redactTransportPayload(item);
      return nextValue;
    },
    {}
  );
}

function logStediTransportDebug(label: string, payload: unknown) {
  if (!claimSubmissionIntegrationConfig.debug.enabled || !isStediSubmissionTarget()) {
    return;
  }

  console.log(
    `[RCM Stedi Claim Submission] ${label}`,
    JSON.stringify(redactTransportPayload(payload), null, 2)
  );
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const responseText = await response.text();

  if (!responseText) {
    return '';
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(responseText) as unknown;
    } catch (error) {
      return responseText;
    }
  }

  return responseText;
}

async function getAccessToken() {
  const { auth, request } = claimSubmissionIntegrationConfig;

  if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
    return undefined;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const response = await fetch(auth.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      grant_type: auth.grantType,
      ...(auth.audience ? { audience: auth.audience } : {}),
    }).toString(),
    signal: AbortSignal.timeout(request.timeoutMs),
  });

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new AppError(
      `Claim submission token request failed with status ${response.status}.`,
      HTTP_STATUS.BAD_GATEWAY
    );
  }

  if (typeof responseBody !== 'object' || responseBody === null) {
    throw new AppError('Claim submission token response is invalid.', HTTP_STATUS.BAD_GATEWAY);
  }

  const accessToken = normalizeText((responseBody as Record<string, unknown>).access_token);

  if (!accessToken) {
    throw new AppError(
      'Claim submission token response did not include an access token.',
      HTTP_STATUS.BAD_GATEWAY
    );
  }

  const expiresInRaw = (responseBody as Record<string, unknown>).expires_in;
  const expiresIn =
    typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw)
      ? expiresInRaw
      : typeof expiresInRaw === 'string' && Number.isFinite(Number(expiresInRaw))
        ? Number(expiresInRaw)
        : 3600;

  cachedToken = {
    accessToken,
    expiresAt: Date.now() + (expiresIn * 1000),
  };

  return accessToken;
}

function buildJsonRequestBody(envelope: ClaimTransportEnvelope) {
  return {
    claimId: envelope.claimId,
    batchId: envelope.batchId,
    submissionTraceId: envelope.submissionTraceId,
    idempotencyKey: envelope.idempotencyKey,
    fileType: envelope.fileType,
    ediPayload: envelope.payload,
    metadata: envelope.metadata,
  };
}

function buildStediTransactionBody(envelope: ClaimTransportEnvelope) {
  return {
    x12: envelope.payload,
  };
}

function buildHeaders(accessToken?: string, envelope?: ClaimTransportEnvelope) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (claimSubmissionIntegrationConfig.request.apiKey) {
    headers[claimSubmissionIntegrationConfig.request.apiKeyHeader] =
      claimSubmissionIntegrationConfig.request.apiKey;
  }

  if (envelope?.idempotencyKey) {
    headers['Idempotency-Key'] = envelope.idempotencyKey;
  }

  return headers;
}

function buildStediHeaders(envelope?: Pick<ClaimTransportEnvelope, 'idempotencyKey'>): Record<string, string> {
  const apiKey = claimSubmissionIntegrationConfig.stedi.apiKey;

  if (!apiKey) {
    throw new AppError(
      'Claim submission integration is not configured. STEDI_API_KEY is required.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  return {
    Accept: 'application/json',
    Authorization: apiKey,
    'Content-Type': 'application/json',
    ...(envelope?.idempotencyKey ? { 'Idempotency-Key': envelope.idempotencyKey } : {}),
  };
}

function normalizeTrackingStatus(value: unknown): ClaimStatusTransportResponse['transmissionStatus'] {
  const normalizedValue = coerceString(value)?.trim().toUpperCase() ?? '';

  if (['ACCEPTED', 'ACKNOWLEDGED', 'APPROVED'].includes(normalizedValue)) {
    return 'ACCEPTED';
  }

  if (['REJECTED', 'FAILED', 'ERROR', 'DENIED'].includes(normalizedValue)) {
    return 'REJECTED';
  }

  if (['SUBMITTED', 'TRANSMITTED'].includes(normalizedValue)) {
    return 'SUBMITTED';
  }

  return 'PENDING';
}

async function fetchWithSingleRetry(url: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      const response = await fetch(url, init);

      if (response.ok || response.status < 500 || attempt === 1) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        break;
      }
    }
  }

  throw new AppError(
    lastError instanceof Error ? lastError.message : 'Claim submission request failed.',
    HTTP_STATUS.BAD_GATEWAY
  );
}

export async function sendClaimSubmission(envelope: ClaimTransportEnvelope): Promise<ClaimTransportResponse> {
  if (!isClaimSubmissionIntegrationConfigured()) {
    throw new AppError(
      'Claim submission integration is not configured. Update the claim submission environment variables.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const transportMode = claimSubmissionIntegrationConfig.request.transportMode;
  const isStediTarget = isStediSubmissionTarget();
  const accessToken = isStediTarget ? undefined : await getAccessToken();
  const headers = isStediTarget ? buildStediHeaders(envelope) : buildHeaders(accessToken, envelope);
  const requestBody = isStediTarget
    ? buildStediTransactionBody(envelope)
    : transportMode === 'x12'
      ? envelope.payload
      : buildJsonRequestBody(envelope);
  const submitUrl = isStediTarget
    ? claimSubmissionIntegrationConfig.stedi.submitEndpoint
    : claimSubmissionIntegrationConfig.request.submitUrl;

  if (transportMode === 'x12' && !isStediTarget) {
    headers['Content-Type'] = 'application/edi-x12';
    headers['x-submission-trace-id'] = envelope.submissionTraceId;
    headers['x-idempotency-key'] = envelope.idempotencyKey;
    headers['x-batch-id'] = envelope.batchId;
    headers['x-file-type'] = envelope.fileType;
  } else {
    headers['Content-Type'] = 'application/json';
  }

  logStediTransportDebug('Request', {
    method: 'POST',
    url: submitUrl,
    headers,
    body: requestBody,
  });

  const response = await fetchWithSingleRetry(submitUrl, {
    method: 'POST',
    headers,
    body: transportMode === 'x12' && !isStediTarget ? envelope.payload : JSON.stringify(requestBody),
    signal: AbortSignal.timeout(claimSubmissionIntegrationConfig.request.timeoutMs),
  });

  const responseBody = await parseResponseBody(response);
  logStediTransportDebug('Response', {
    status: response.status,
    ok: response.ok,
    body: responseBody,
  });
  const serializedRequestPayload =
    transportMode === 'x12' && !isStediTarget ? envelope.payload : serializePayload(requestBody);
  const serializedResponsePayload = serializePayload(responseBody);

  if (!response.ok) {
    const message =
      normalizeText(
        coerceString(readFirstPath(responseBody, ['message', 'error.message', 'error', 'detail']))
      ) || `Claim submission request failed with status ${response.status}.`;

    throw new AppError(message, HTTP_STATUS.BAD_GATEWAY, [
      {
        field: 'claimSubmission',
        message,
        responseStatusCode: response.status,
        requestPayload: serializePayload(redactTransportPayload(serializedRequestPayload)),
        responsePayload: serializePayload(redactTransportPayload(responseBody)),
      },
    ]);
  }

  const transmissionStatus =
    normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.transmissionStatusPaths)
      )
    ) || 'Transmitted';
  const acknowledgementStatus =
    normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.acknowledgementStatusPaths)
      )
    ) || 'Pending Acknowledgement';

  return {
    externalSubmissionId: normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.externalSubmissionIdPaths)
      )
    ),
    externalBatchId: normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.externalBatchIdPaths)
      )
    ),
    claimControlNumber: normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.claimControlNumberPaths)
      )
    ),
    clearinghouseTraceNumber: normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.clearinghouseTraceNumberPaths)
      )
    ),
    payerClaimNumber: normalizeText(
      coerceString(
        readFirstPath(responseBody, claimSubmissionIntegrationConfig.response.payerClaimNumberPaths)
      )
    ),
    transmissionStatus,
    acknowledgementStatus,
    responseStatusCode: response.status,
    requestPayload: serializedRequestPayload,
    responsePayload: serializedResponsePayload,
  };
}

export async function getClaimSubmissionStatus(options: {
  externalSubmissionId: string;
  idempotencyKey?: string;
}): Promise<ClaimStatusTransportResponse> {
  if (!isClaimSubmissionIntegrationConfigured()) {
    throw new AppError(
      'Claim submission integration is not configured. Update the claim submission environment variables.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const isStediTarget = isStediSubmissionTarget();
  const externalSubmissionId = normalizeText(options.externalSubmissionId);

  if (!externalSubmissionId) {
    throw new AppError('External submission ID is required for claim status tracking.', HTTP_STATUS.BAD_REQUEST);
  }

  const statusUrl = isStediTarget
    ? claimSubmissionIntegrationConfig.stedi.statusEndpoint
    : claimSubmissionIntegrationConfig.request.statusUrl;
  const requestUrl = `${statusUrl.replace(/\/+$/, '')}/${encodeURIComponent(externalSubmissionId)}`;
  const headers = isStediTarget
    ? buildStediHeaders(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } as ClaimTransportEnvelope : undefined)
    : buildHeaders(await getAccessToken(), options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } as ClaimTransportEnvelope : undefined);

  const requestPayload = serializePayload({ method: 'GET', url: requestUrl, externalSubmissionId });
  logStediTransportDebug('Status Request', {
    method: 'GET',
    url: requestUrl,
    headers,
    externalSubmissionId,
  });
  const response = await fetchWithSingleRetry(requestUrl, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(claimSubmissionIntegrationConfig.request.timeoutMs),
  });
  const responseBody = await parseResponseBody(response);
  logStediTransportDebug('Status Response', {
    status: response.status,
    ok: response.ok,
    body: responseBody,
  });
  const serializedResponsePayload = serializePayload(responseBody);

  if (!response.ok) {
    const message =
      normalizeText(coerceString(readFirstPath(responseBody, ['message', 'error.message', 'error', 'detail'])))
      || `Claim status request failed with status ${response.status}.`;

    throw new AppError(message, HTTP_STATUS.BAD_GATEWAY, [
      {
        field: 'claimTracking',
        message,
        responseStatusCode: response.status,
        requestPayload,
        responsePayload: serializedResponsePayload,
      },
    ]);
  }

  const statusValue = readFirstPath(responseBody, [
    'status',
    'transaction.status',
    'data.status',
    'result.status',
    'acknowledgementStatus',
  ]);

  return {
    externalSubmissionId,
    claimControlNumber: normalizeText(coerceString(readFirstPath(responseBody, [
      'controlNumber',
      'claimControlNumber',
      'transaction.controlNumber',
      'data.controlNumber',
    ]))),
    clearinghouseTraceNumber: normalizeText(coerceString(readFirstPath(responseBody, [
      'traceNumber',
      'transaction.traceNumber',
      'data.traceNumber',
    ]))),
    payerClaimNumber: normalizeText(coerceString(readFirstPath(responseBody, [
      'payerClaimNumber',
      'transaction.payerClaimNumber',
      'data.payerClaimNumber',
    ]))),
    transmissionStatus: normalizeTrackingStatus(statusValue),
    acknowledgementStatus: normalizeText(coerceString(statusValue)),
    responseStatusCode: response.status,
    requestPayload,
    responsePayload: serializedResponsePayload,
  };
}
