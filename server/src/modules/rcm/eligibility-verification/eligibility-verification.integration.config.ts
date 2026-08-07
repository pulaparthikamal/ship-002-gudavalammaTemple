import { envConfig } from '../../../config/env.config';

type PayerIdentifierSource = 'auto' | 'payerId' | 'ediPayerId';

function normalizePayerIdentifierSource(value: string): PayerIdentifierSource {
  switch (value) {
    case 'payerId':
    case 'ediPayerId':
      return value;
    default:
      return 'auto';
  }
}

export const eligibilityIntegrationConfig = {
  enabled: envConfig.eligibilityVendorEnabled,
  vendorName: envConfig.eligibilityVendorName.trim() || 'stedi',
  auth: {
    tokenUrl: envConfig.eligibilityAuthUrl.trim(),
    audience: envConfig.eligibilityAudience.trim(),
    clientId: envConfig.eligibilityClientId.trim(),
    clientSecret: envConfig.eligibilityClientSecret.trim(),
    grantType: envConfig.eligibilityGrantType.trim() || 'client_credentials',
  },
  request: {
    verificationUrl: envConfig.eligibilityVerificationUrl.trim() || envConfig.stediEligibilityEndpoint.trim(),
    timeoutMs: envConfig.eligibilityRequestTimeoutMs,
    payloadVersion: envConfig.eligibilityPayloadVersion.trim() || '1.0.0',
    priority: envConfig.eligibilityDefaultPriority.trim() || 'Normal',
    defaultServiceTypeCode:
      envConfig.eligibilityDefaultServiceTypeCode.trim() || '30',
    defaultProcedureCodes: envConfig.eligibilityDefaultProcedureCodes,
    defaultCategories: envConfig.eligibilityDefaultCategories,
    defaultPlanTypes: envConfig.eligibilityDefaultPlanTypes,
    defaultNetworkStatuses: envConfig.eligibilityDefaultNetworkStatuses,
    payerIdentifierSource: normalizePayerIdentifierSource(
      envConfig.eligibilityPayerIdentifierSource
    ),
    correlationPrefix: 'IV',
    reverificationDays: envConfig.eligibilityReverificationDays,
  },
  storage: {
    storeRawPayloads: envConfig.eligibilityStoreRawPayloads,
  },
  stedi: {
    apiKey: (envConfig.stediEligibilityApiKey || envConfig.stediApiKey).trim(),
    eligibilityEndpoint: envConfig.stediEligibilityEndpoint.trim(),
  },
  debug: {
    enabled: envConfig.rcmStediDebugLogs,
  },
  response: {
    externalVerificationIdPaths: [
      'id',
      'verificationId',
      'insuranceVerificationId',
      'transactionId',
      'transaction.id',
      'data.transactionId',
      'data.id',
      'data.verificationId',
      'data.insuranceVerificationId',
      'result.id',
      'result.verificationId',
      'correlationId',
    ],
    eligibilityStatusPaths: [
      'status',
      'verificationStatus',
      'eligibilityStatus',
      'coverageStatus',
      'coverage.status',
      'data.status',
      'data.verificationStatus',
      'result.status',
      'result.verificationStatus',
    ],
    coverageStatusPaths: [
      'coverageStatus',
      'status',
      'planStatus',
      'data.coverageStatus',
      'data.planStatus',
      'data.coverage.status',
      'result.coverageStatus',
      'result.planStatus',
      'coverage.status',
      'eligibility.coverageStatus',
      'plan.status',
    ],
    planActivePaths: [
      'planActive',
      'coverageActive',
      'isActive',
      'data.planActive',
      'data.coverageActive',
      'data.coverage.active',
      'result.planActive',
      'result.coverageActive',
      'coverage.active',
      'eligibility.active',
      'plan.active',
    ],
    copayAmountPaths: [
      'copayAmount',
      'data.copayAmount',
      'financial.copayAmount',
      'financial.copay.amount',
      'benefits.copay.amount',
      'benefits.0.copay.amount',
      'copay.amount',
      'result.copayAmount',
    ],
    coinsurancePercentPaths: [
      'coinsurancePercent',
      'data.coinsurancePercent',
      'financial.coinsurancePercent',
      'financial.coinsurance.percent',
      'benefits.coinsurance.percent',
      'benefits.0.coinsurance.percent',
      'coinsurance.percent',
      'result.coinsurancePercent',
    ],
    deductibleRemainingPaths: [
      'deductibleRemaining',
      'data.deductibleRemaining',
      'financial.deductibleRemaining',
      'financial.deductible.remaining',
      'benefits.deductible.remaining',
      'benefits.0.deductible.remaining',
      'deductible.remaining',
      'result.deductibleRemaining',
    ],
    outOfPocketRemainingPaths: [
      'outOfPocketRemaining',
      'data.outOfPocketRemaining',
      'financial.outOfPocketRemaining',
      'financial.outOfPocket.remaining',
      'benefits.outOfPocket.remaining',
      'benefits.0.outOfPocket.remaining',
      'outOfPocket.remaining',
      'result.outOfPocketRemaining',
    ],
    networkStatusPaths: [
      'networkStatus',
      'network.status',
      'benefits.networkStatus',
      'benefits.0.networkStatus',
      'data.networkStatus',
      'result.networkStatus',
    ],
    referralRequiredPaths: [
      'referralRequired',
      'data.referralRequired',
      'benefits.referralRequired',
      'requirements.referralRequired',
      'referralRequiredIndicator',
      'result.referralRequired',
    ],
    authorizationRequiredPaths: [
      'authorizationRequired',
      'data.authorizationRequired',
      'benefits.authorizationRequired',
      'requirements.authorizationRequired',
      'authRequired',
      'authorizationRequiredIndicator',
      'result.authorizationRequired',
    ],
    benefitNotesPaths: [
      'benefitNotes',
      'notes',
      'message',
      'messages',
      'data.benefitNotes',
      'data.notes',
      'data.message',
      'result.benefitNotes',
      'result.notes',
      'result.message',
    ],
    nextVerificationDueDatePaths: [
      'nextVerificationDueDate',
      'nextCheckDate',
      'data.nextVerificationDueDate',
      'data.nextCheckDate',
      'result.nextVerificationDueDate',
      'result.nextCheckDate',
    ],
  },
} as const;

export function isEligibilityIntegrationConfigured() {
  if (!eligibilityIntegrationConfig.enabled) {
    return false;
  }

  const { auth, request } = eligibilityIntegrationConfig;
  const vendorName = eligibilityIntegrationConfig.vendorName.trim().toLowerCase();
  const stediTarget = vendorName === 'stedi' || request.verificationUrl.toLowerCase().includes('stedi.com');

  if (stediTarget) {
    return Boolean(eligibilityIntegrationConfig.stedi.apiKey && eligibilityIntegrationConfig.stedi.eligibilityEndpoint);
  }

  return Boolean(
    auth.tokenUrl &&
      auth.clientId &&
      auth.clientSecret &&
      auth.audience &&
      request.verificationUrl
  );
}
