import { Request, Response } from 'express';
import { Ai835Payload } from './ai-835-payload.model';
import { ai835GeneratorService } from './ai-835-generator.service';
import respUtil from '../../../utils/resp.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export const ai835PayloadController = {
  /**
   * GET /ai-835-payloads/by-claim-submission/:claimSubmissionId
   * Returns the stored AI-generated 835 payloads for a given claim submission,
   * or null data if nothing has been generated yet.
   */
  async getByClaimSubmission(req: Request, res: Response) {
    const { claimSubmissionId } = req.params;
    if (!claimSubmissionId) {
      throw new AppError('claimSubmissionId param is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const record = await Ai835Payload.findOne({
      claimSubmissionId,
      isDeleted: false,
    }).lean();

    return res.json(respUtil.dataSuccessResponse(req, record ?? null));
  },

  /**
   * POST /ai-835-payloads/generate
   * Generates three EDI X12 835 scenarios (via OpenAI or local fallback),
   * then upserts the result into the ai835payloads collection.
   * Returns the saved document.
   */
  async generateAndSave(req: Request, res: Response) {
    const { claimId, claimSubmissionId, eraEobProcessingId } = req.body;

    if (!claimId || !claimSubmissionId) {
      throw new AppError('claimId and claimSubmissionId are required.', HTTP_STATUS.BAD_REQUEST);
    }

    const generated = await ai835GeneratorService.generateAi835(claimId, claimSubmissionId);

    const record = await Ai835Payload.findOneAndUpdate(
      { claimSubmissionId },
      {
        $set: {
          claimId,
          claimSubmissionId,
          ...(eraEobProcessingId ? { eraEobProcessingId } : {}),
          fullPayment835: generated.fullPayment835,
          denialPayment835: generated.denialPayment835,
          denialCorrection835: generated.denialCorrection835,
          generatedAt: new Date(),
          generatedBy: (req as any).user?._id,
          isDeleted: false,
        },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json(respUtil.dataSuccessResponse(req, record));
  },
};
