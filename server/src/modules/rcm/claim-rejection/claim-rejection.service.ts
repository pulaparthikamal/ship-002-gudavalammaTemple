import { ClaimRejection } from './claim-rejection.model';
import { claimRejectionAiService } from './claim-rejection-ai.service';
import { Claim } from '../claim/claim.model';
import { Payer } from '../payer/payer.model';
import { Provider } from '../provider/provider.model';
import { AuditLog } from '../audit-log/audit-log.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function isObjectId(value: unknown) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

function categorizeRejection(code?: string, reason?: string) {
  const text = `${code ?? ''} ${reason ?? ''}`.toLowerCase();

  if (/(diagnosis|icd|dx)/.test(text)) return 'Coding';
  if (/(cpt|hcpcs|procedure|modifier)/.test(text)) return 'Coding';
  if (/(member|subscriber|eligibility|coverage|patient)/.test(text)) return 'Eligibility';
  if (/(provider|npi|taxonomy|tax)/.test(text)) return 'Provider';
  if (/(attachment|document|medical record)/.test(text)) return 'Documentation';
  return 'Clearinghouse';
}

async function writeAuditLog(data: any, userId?: string) {
  if (!userId) {
    return;
  }

  await AuditLog.create({
    ...data,
    changedBy: userId,
    timestamp: new Date(),
    sourceModule: 'claim-rejection',
    active: true,
    created: new Date(),
    updated: new Date(),
    createdBy: userId,
    updatedBy: userId,
  });
}

export const claimRejectionService = {
  async createFromSubmission(
    claim: any,
    submission: any,
    data: {
      rejectionCode?: string;
      rejectionReason?: string;
      payerResponse?: Record<string, unknown>;
      category?: string;
    },
    updatedBy?: string
  ) {
    const rejectionCode = normalizeText(data.rejectionCode);
    const rejectionReason =
      normalizeText(data.rejectionReason)
      ?? normalizeText(submission?.submissionErrorMessage)
      ?? normalizeText(submission?.acknowledgementStatus)
      ?? 'Claim rejected by clearinghouse or payer.';

    const item = await ClaimRejection.findOneAndUpdate(
      {
        claimId: claim._id,
        claimSubmissionId: submission?._id,
        rejectionCode: rejectionCode ?? undefined,
        isDeleted: false,
      },
      {
        $setOnInsert: {
          claimId: claim._id,
          claimSubmissionId: submission?._id,
          originalClaimSnapshot: toPlainObject(claim),
          active: true,
          created: new Date(),
          createdBy: updatedBy,
        },
        $set: {
          rejectionCode,
          rejectionReason,
          payerResponse: data.payerResponse,
          category: data.category ?? categorizeRejection(rejectionCode, rejectionReason),
          status: 'Open',
          updated: new Date(),
          updatedBy,
        },
      },
      { new: true, upsert: true }
    );

    await writeAuditLog(
      {
        entityType: 'ClaimRejection',
        entityId: item._id,
        action: 'RejectionCaptured',
        fieldName: 'status',
        newValue: {
          claimId: String(claim._id),
          rejectionCode,
          rejectionReason,
        },
      },
      updatedBy
    );

    return item;
  },

  async listForClaim(claimId: string) {
    return ClaimRejection.find({ claimId, isDeleted: false })
      .sort({ created: -1 });
  },

  async listOpenRejectedClaims() {
    return Claim.find({
      isDeleted: false,
      active: true,
      $or: [
        { claimStatus: 'Rejected' },
        { submissionStatus: 'Rejected' },
      ],
    }).sort({ updated: -1 });
  },

  async analyzeClaim(claimId: string, locale: string, updatedBy: string) {
    const claim = await Claim.findOne({ _id: claimId, isDeleted: false });

    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const rejection = await ClaimRejection.findOne({
      claimId: claim._id,
      isDeleted: false,
    }).sort({ created: -1 });

    if (!rejection) {
      throw new AppError('Claim has no rejection history to analyze.', HTTP_STATUS.BAD_REQUEST);
    }

    const [payer, provider] = await Promise.all([
      claim.payerId
        ? Payer.findOne({
            $or: [
              { payerId: claim.payerId },
              ...(isObjectId(claim.payerId) ? [{ _id: claim.payerId }] : []),
            ],
            isDeleted: false,
            active: true,
          })
        : null,
      claim.renderingProviderId
        ? Provider.findOne({ _id: claim.renderingProviderId, isDeleted: false, active: true })
        : null,
    ]);

    const suggestion = await claimRejectionAiService.analyze({
      rejectionCode: rejection.rejectionCode,
      rejectionReason: rejection.rejectionReason,
      cptCodes: (claim.claimLines ?? []).map((line: any) => line.cptCode).filter(Boolean),
      icdCodes: claim.diagnosisCodes ?? [],
      payer: toPlainObject(payer),
      provider: toPlainObject(provider),
    });

    rejection.aiSuggestion = {
      ...suggestion,
      modelVersion: 'claim-rejection-rules-v1',
      generatedAt: new Date(),
    };
    rejection.updatedBy = updatedBy as any;
    rejection.updated = new Date();
    await rejection.save();

    await writeAuditLog(
      {
        entityType: 'ClaimRejection',
        entityId: rejection._id,
        action: 'AiSuggestionGenerated',
        fieldName: 'aiSuggestion',
        newValue: rejection.aiSuggestion,
      },
      updatedBy
    );

    return {
      ...suggestion,
      rejectionId: String(rejection._id),
    };
  },

  async markResolvedForClaim(claimId: string, resubmittedClaimId: string, updatedBy: string) {
    const result = await ClaimRejection.updateMany(
      {
        claimId,
        isDeleted: false,
        status: { $ne: 'Resolved' },
      },
      {
        $set: {
          status: 'Resolved',
          resolvedAt: new Date(),
          resolvedBy: updatedBy,
          resubmittedClaimId,
          updatedBy,
          updated: new Date(),
        },
      }
    );

    if (result.modifiedCount) {
      await writeAuditLog(
        {
          entityType: 'Claim',
          entityId: claimId,
          action: 'RejectionResolved',
          fieldName: 'claimRejections',
          newValue: {
            resubmittedClaimId,
            resolvedCount: result.modifiedCount,
          },
        },
        updatedBy
      );
    }

    return result;
  },
};
