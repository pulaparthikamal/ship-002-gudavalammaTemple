import { envConfig } from '../../../config/env.config';

type ClaimSubmissionTransportMode = 'json' | 'x12';

function normalizeTransportMode(value: string): ClaimSubmissionTransportMode {
  switch (value.trim().toLowerCase()) {
    case 'x12':
      return 'x12';
    default:
      return 'json';
  }
}

function normalizeUsageIndicator(value: string) {
  const normalizedValue = value.trim().toUpperCase();
  return ['P', 'T', 'I'].includes(normalizedValue) ? normalizedValue : 'T';
}

export const claimSubmissionIntegrationConfig = {
  enabled: envConfig.claimSubmissionEnabled,
  vendorName: envConfig.claimSubmissionVendorName.trim() || 'generic-clearinghouse',
  auth: {
    tokenUrl: envConfig.claimSubmissionAuthUrl.trim(),
    audience: envConfig.claimSubmissionAudience.trim(),
    clientId: envConfig.claimSubmissionClientId.trim(),
    clientSecret: envConfig.claimSubmissionClientSecret.trim(),
    grantType: envConfig.claimSubmissionGrantType.trim() || 'client_credentials',
  },
  request: {
    submitUrl: envConfig.claimSubmissionSubmitUrl.trim() || envConfig.stediSubmitEndpoint.trim(),
    statusUrl: envConfig.stediStatusEndpoint.trim(),
    timeoutMs: envConfig.claimSubmissionTimeoutMs,
    transportMode: normalizeTransportMode(envConfig.claimSubmissionTransportMode),
    apiKey: envConfig.claimSubmissionApiKey.trim(),
    apiKeyHeader: envConfig.claimSubmissionApiKeyHeader.trim() || 'x-api-key',
    usageIndicator: normalizeUsageIndicator(envConfig.claimSubmissionUsageIndicator),
    senderId: envConfig.stediSubmitterId.trim() || envConfig.claimSubmissionSenderId.trim() || 'RCMSENDER',
    receiverId: envConfig.stediReceiverId.trim() || envConfig.claimSubmissionReceiverId.trim() || 'CLEARINGHOUSE',
    submitterId: envConfig.stediSubmitterId.trim() || envConfig.claimSubmissionSubmitterId.trim() || 'RCMAPP',
    submitterName: envConfig.claimSubmissionSubmitterName.trim() || 'Realtime RCM',
    receiverName: envConfig.claimSubmissionReceiverName.trim() || 'Clearinghouse',
    contactName: envConfig.claimSubmissionContactName.trim() || 'RCM Support',
    contactPhone: envConfig.claimSubmissionContactPhone.trim(),
    maxRetries: envConfig.claimSubmissionMaxRetries,
    controlPrefix: 'CLM',
    batchPrefix: 'BATCH',
  },
  stedi: {
    apiKey: envConfig.stediApiKey.trim(),
    submitEndpoint: envConfig.stediSubmitEndpoint.trim(),
    statusEndpoint: envConfig.stediStatusEndpoint.trim(),
    testPayerId: envConfig.stediTestPayerId.trim(),
    testBillingNpi: envConfig.stediTestBillingNpi.trim(),
    testBillingTaxId: envConfig.stediTestBillingTaxId.trim(),
    submitterId: envConfig.stediSubmitterId.trim(),
    receiverId: envConfig.stediReceiverId.trim(),
  },
  debug: {
    enabled: envConfig.rcmStediDebugLogs,
  },
  webhook: {
    secret: envConfig.stediWebhookSecret.trim() || envConfig.claimSubmissionWebhookSecret.trim(),
    signatureHeader: envConfig.stediWebhookSignatureHeader.trim() || 'x-stedi-signature',
    timestampHeader: envConfig.stediWebhookTimestampHeader.trim() || 'x-stedi-timestamp',
    toleranceSeconds: envConfig.stediWebhookToleranceSeconds,
  },
  storage: {
    storeRawPayloads: envConfig.claimSubmissionStoreRawPayloads,
  },
  response: {
    externalSubmissionIdPaths: [
      'submissionId',
      'id',
      'transactionId',
      'transaction.id',
      'data.transactionId',
      'claimReference.correlationId',
      'meta.traceId',
      'data.submissionId',
      'data.id',
      'result.submissionId',
      'result.id',
    ],
    externalBatchIdPaths: [
      'batchId',
      'data.batchId',
      'result.batchId',
    ],
    claimControlNumberPaths: [
      'claimControlNumber',
      'controlNumber',
      'data.controlNumber',
      'transaction.controlNumber',
      'claimReference.patientControlNumber',
      'claimReference.customerClaimNumber',
      'data.claimControlNumber',
      'result.claimControlNumber',
    ],
    clearinghouseTraceNumberPaths: [
      'traceNumber',
      'meta.traceId',
      'claimReference.correlationId',
      'clearinghouseTraceNumber',
      'submissionTraceId',
      'data.traceNumber',
      'data.clearinghouseTraceNumber',
      'result.traceNumber',
      'result.clearinghouseTraceNumber',
    ],
    payerClaimNumberPaths: [
      'payerClaimNumber',
      'data.payerClaimNumber',
      'result.payerClaimNumber',
    ],
    transmissionStatusPaths: [
      'transmissionStatus',
      'status',
      'transaction.status',
      'data.transmissionStatus',
      'data.status',
      'result.transmissionStatus',
      'result.status',
    ],
    acknowledgementStatusPaths: [
      'acknowledgementStatus',
      'ackStatus',
      'data.acknowledgementStatus',
      'data.ackStatus',
      'result.acknowledgementStatus',
      'result.ackStatus',
    ],
  },
} as const;

export function validateClaimSubmissionStartupConfig() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = envConfig.nodeEnv.trim().toLowerCase();
  const usageIndicator = claimSubmissionIntegrationConfig.request.usageIndicator;
  const vendorName = claimSubmissionIntegrationConfig.vendorName.trim().toLowerCase();
  const submitUrl = claimSubmissionIntegrationConfig.request.submitUrl.trim().toLowerCase();
  const stediTarget = vendorName === 'stedi' || submitUrl.includes('stedi.com');
  const queueDriver = envConfig.rcmQueueDriver.trim().toLowerCase();

  if (nodeEnv === 'production' && usageIndicator !== 'P') {
    errors.push('CLAIM_SUBMISSION_USAGE_INDICATOR must be P in production.');
  }

  if (nodeEnv === 'production') {
    if (queueDriver === 'memory') {
      errors.push('RCM_QUEUE_DRIVER=memory is not allowed in production.');
    }
    if (queueDriver === 'mongo' || queueDriver === 'database') {
      warnings.push('RCM_QUEUE_DRIVER=mongo is durable but not a true distributed queue; BullMQ/Redis or SQS is preferred for production.');
    }
    if (envConfig.rcmAllowPhiLogs) {
      errors.push('RCM_ALLOW_PHI_LOGS must be false in production.');
    }
    if (claimSubmissionIntegrationConfig.stedi.testPayerId) {
      errors.push('STEDI_TEST_PAYER_ID must not be configured in production.');
    }
    if (claimSubmissionIntegrationConfig.stedi.testBillingNpi || claimSubmissionIntegrationConfig.stedi.testBillingTaxId) {
      errors.push('STEDI_TEST_BILLING_NPI and STEDI_TEST_BILLING_TAX_ID must not be configured in production.');
    }
    if (!claimSubmissionIntegrationConfig.webhook.secret) {
      errors.push('STEDI_WEBHOOK_SECRET or CLAIM_SUBMISSION_WEBHOOK_SECRET is required for production clearinghouse webhooks.');
    }
  }

  if (claimSubmissionIntegrationConfig.enabled && stediTarget) {
    if (!claimSubmissionIntegrationConfig.stedi.apiKey) {
      errors.push('STEDI_API_KEY is required when claim submission is enabled for Stedi.');
    }
    if (!claimSubmissionIntegrationConfig.stedi.submitEndpoint) {
      errors.push('STEDI_SUBMIT_ENDPOINT is required when claim submission is enabled for Stedi.');
    }
    if (!claimSubmissionIntegrationConfig.stedi.statusEndpoint) {
      warnings.push('STEDI_STATUS_ENDPOINT is not configured; status refresh may not work.');
    }
  }

  if (usageIndicator === 'T' && !claimSubmissionIntegrationConfig.stedi.testPayerId) {
    warnings.push('CLAIM_SUBMISSION_USAGE_INDICATOR is T but STEDI_TEST_PAYER_ID is not configured.');
  }

  return { errors, warnings };
}

export function isClaimSubmissionIntegrationConfigured() {
  if (!claimSubmissionIntegrationConfig.enabled) {
    return false;
  }

  const vendorName = claimSubmissionIntegrationConfig.vendorName.trim().toLowerCase();
  const submitUrl = claimSubmissionIntegrationConfig.request.submitUrl.trim().toLowerCase();
  const stediTarget = vendorName === 'stedi' || submitUrl.includes('stedi.com');

  if (stediTarget) {
    return Boolean(
      claimSubmissionIntegrationConfig.stedi.apiKey
      && claimSubmissionIntegrationConfig.stedi.submitEndpoint
    );
  }

  return Boolean(claimSubmissionIntegrationConfig.request.submitUrl);
}
