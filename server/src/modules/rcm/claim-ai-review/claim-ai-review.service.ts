import { ClaimAiReview } from './claim-ai-review.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { Claim } from '../claim/claim.model';
import { appendStatusHistory } from '../workflow/workflow-history';

const DEFAULT_BLOCK_THRESHOLD = 0.75;

type ClaimAiReviewContext = {
  insurancePolicy?: any;
  payer?: any;
  facility?: any;
  billingProvider?: any;
  renderingProvider?: any;
  eligibility?: any;
  authorization?: any;
  referral?: any;
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

function normalizeIdentifier(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (value && typeof (value as any).toString === 'function') {
    const normalizedValue = (value as any).toString().trim();
    return normalizedValue && normalizedValue !== '[object Object]' ? normalizedValue : undefined;
  }

  return undefined;
}

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));
}

function resolveRiskLevel(score: number) {
  if (score >= 0.75) {
    return 'Critical';
  }

  if (score >= 0.55) {
    return 'High';
  }

  if (score >= 0.3) {
    return 'Medium';
  }

  return 'Low';
}

function resolveBlockThreshold() {
  const configuredValue = Number(process.env.RCM_AI_CLAIM_REVIEW_BLOCK_THRESHOLD);

  if (Number.isFinite(configuredValue) && configuredValue >= 0 && configuredValue <= 1) {
    return configuredValue;
  }

  return DEFAULT_BLOCK_THRESHOLD;
}

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function resolveReferralNumber(referral: any) {
  return normalizeText(referral?.referralNumber);
}

function resolveAuthorizationNumber(authorization: any) {
  return normalizeText(authorization?.authNumber);
}

function buildClaimData(claim: any, context: ClaimAiReviewContext = {}) {
  const claimObject = typeof claim.toObject === 'function' ? claim.toObject() : claim;
  const insurancePolicy = toPlainObject(context.insurancePolicy) ?? {};
  const payer = toPlainObject(context.payer) ?? {};
  const facility = toPlainObject(context.facility) ?? {};
  const billingProvider = toPlainObject(context.billingProvider) ?? {};
  const renderingProvider = toPlainObject(context.renderingProvider) ?? {};
  const eligibility = toPlainObject(context.eligibility) ?? {};
  const authorization = toPlainObject(context.authorization) ?? {};
  const referral = toPlainObject(context.referral) ?? {};
  const electronicPayerId =
    normalizeText(insurancePolicy.ediPayerId)
    ?? normalizeText(payer.ediPayerId);

  return {
    claimId: normalizeIdentifier(claimObject._id),
    claimDate: claimObject.claimDate,
    payerId: normalizeIdentifier(claimObject.payerId ?? insurancePolicy.payerId ?? payer.payerId),
    payerName: normalizeText(payer.payerName),
    payerType: normalizeText(insurancePolicy.payerType) ?? normalizeText(payer.payerType),
    claimsSubmissionMethod: normalizeText(payer.claimsSubmissionMethod),
    ediPayerId: electronicPayerId,
    memberId: normalizeText(insurancePolicy.memberId),
    subscriberId: normalizeText(insurancePolicy.subscriberId) ?? normalizeText(insurancePolicy.memberId),
    groupNumber: normalizeText(insurancePolicy.groupNumber),
    billingProviderId: normalizeIdentifier(claimObject.billingProviderId),
    renderingProviderId: normalizeIdentifier(claimObject.renderingProviderId),
    facilityId: normalizeIdentifier(claimObject.facilityId),
    billingProviderNpi: normalizeText(facility.npi) ?? normalizeText(billingProvider.npi),
    facilityNpi: normalizeText(facility.npi),
    facilityTaxId: normalizeText(facility.taxId),
    renderingProviderNpi: normalizeText(renderingProvider.npi) ?? normalizeText(billingProvider.npi),
    renderingProviderTaxonomyCode: normalizeText(renderingProvider.taxonomyCode),
    authorizationRequired: Boolean(eligibility.authorizationRequired),
    authNumber: resolveAuthorizationNumber(authorization),
    referralRequired: Boolean(eligibility.referralRequired),
    referralNumber: resolveReferralNumber(referral),
    diagnosisCodes: claimObject.diagnosisCodes ?? [],
    totalChargeAmount: claimObject.totalChargeAmount,
    claimStatus: claimObject.claimStatus,
    scrubStatus: claimObject.scrubStatus,
    submissionStatus: claimObject.submissionStatus,
    correctedClaimIndicator: claimObject.correctedClaimIndicator,
    originalClaimId: normalizeIdentifier(claimObject.originalClaimId),
    claimLines: (claimObject.claimLines ?? []).map((line: any) => ({
      lineNumber: line.lineNumber,
      cptCode: line.cptCode,
      modifiers: line.modifiers ?? [],
      icdPointers: line.icdPointers ?? [],
      units: line.units,
      chargeAmount: line.chargeAmount,
      renderingProviderId: normalizeIdentifier(line.renderingProviderId),
      placeOfService: line.placeOfService,
      serviceDateFrom: line.serviceDateFrom,
      serviceDateTo: line.serviceDateTo,
    })),
  };
}

function isHumanOverride(review: any) {
  return ['override approved', 'human approved'].includes(normalizeText(review?.reviewStatus)?.toLowerCase() ?? '');
}

export const claimAiReviewService = {
  async create(data: any, locale: string, createdBy: string) {
    const item = await ClaimAiReview.create({
      ...data,
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await ClaimAiReview.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claimAiReview.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await ClaimAiReview.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('claimAiReview.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async runPreSubmissionReview(
    claim: any,
    updatedBy: string,
    context: ClaimAiReviewContext = {}
  ) {
    const existingReview = await ClaimAiReview.findOne({
      claimId: claim._id,
      isDeleted: false,
      active: true,
    }).sort({ updated: -1 });

    if (existingReview && isHumanOverride(existingReview)) {
      existingReview.denialPrediction = {
        ...(toPlainObject(existingReview.denialPrediction) ?? {}),
        reviewRequired: false,
      };
      existingReview.blockingReasons = [];
      existingReview.updatedBy = updatedBy;
      existingReview.updated = new Date();
      await existingReview.save();
      return existingReview;
    }

    const payerId =
      normalizeIdentifier(claim?.payerId)
      ?? normalizeIdentifier(context.insurancePolicy?.payerId)
      ?? normalizeIdentifier(context.payer?.payerId);

    if (!payerId) {
      throw new AppError('Claim AI review requires a payer before submission.', HTTP_STATUS.BAD_REQUEST);
    }

    const prediction = await rcmAiService.predictDenial(buildClaimData(claim, context), payerId);
    const riskScore = Math.max(0, Math.min(1, Number(prediction.denialProbability ?? 0)));
    const predictedReasons = normalizeStringArray(prediction.potentialRejectionReasons);
    const recommendedFixes = normalizeStringArray(prediction.recommendedActions);
    const reviewRequired = riskScore >= resolveBlockThreshold();
    const blockingReasons = reviewRequired
      ? predictedReasons.length
        ? predictedReasons
        : ['AI denial risk exceeded the configured pre-submission threshold.']
      : [];
    const reviewStatus = reviewRequired ? 'Needs Review' : 'Passed';

    const item = await ClaimAiReview.findOneAndUpdate(
      {
        claimId: claim._id,
        isDeleted: false,
      },
      {
        $set: {
          claimId: claim._id,
          reviewStatus,
          blockingReasons,
          denialPrediction: {
            riskScore,
            riskLevel: resolveRiskLevel(riskScore),
            predictedReasons,
            recommendedFixes,
            modelVersion: 'rcm-denial-prediction-v1',
            predictedAt: new Date(),
            confidenceScore: prediction.status === 'error' ? 0 : 0.7,
            reviewRequired,
          },
          active: true,
          updatedBy,
          updated: new Date(),
        },
        $setOnInsert: {
          created: new Date(),
          createdBy: updatedBy,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    if (!item) {
      throw new AppError('Unable to create or update claim AI review.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return item;
  },

  async approveOverride(id: string, locale: string, updatedBy: string, overrideReason: string) {
    const item = await this.getById(id, locale);

    if (!item.claimId) {
      throw new AppError('AI review override requires a linked claim.', HTTP_STATUS.BAD_REQUEST);
    }

    const claim = await Claim.findOne({ _id: item.claimId, isDeleted: false });

    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    item.reviewStatus = 'Override Approved';
    item.blockingReasons = [];
    item.overrideReason = overrideReason;
    item.overriddenBy = updatedBy as any;
    item.overriddenAt = new Date();
    item.denialPrediction = {
      ...(toPlainObject(item.denialPrediction) ?? {}),
      reviewRequired: false,
    };
    item.updatedBy = updatedBy;
    item.updated = new Date();
    await item.save();

    if (claim.claimStatus === 'On Hold') {
      claim.claimStatus = 'Ready for Submission';
      claim.rejectionReason = undefined;
      claim.statusHistory = appendStatusHistory(
        claim.statusHistory,
        claim.claimStatus,
        updatedBy,
        `AI review override approved: ${overrideReason}`
      );
      claim.updatedBy = updatedBy;
      claim.updated = new Date();
      await claim.save();
    }

    return {
      claimAiReview: item,
      claim,
    };
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await ClaimAiReview.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('claimAiReview.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
