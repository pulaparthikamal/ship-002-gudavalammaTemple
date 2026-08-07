import { Request, Response } from 'express';
import { claimPredictionService } from './claim-prediction.service';
import { predictionRequestSchema } from './claim-prediction.schema';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';

export class ClaimPredictionController {
  async predict(req: Request, res: Response) {
    if (!await serviceUtil.checkPermission(req, res, 'View', 'claim-predictions')) {
      req.statusCode = HTTP_STATUS.FORBIDDEN;
      req.errorMessage = t('auth.forbidden', {}, req.locale);
      return res.status(HTTP_STATUS.FORBIDDEN).json(respUtil.getErrorResponse(req));
    }
    const validatedData = predictionRequestSchema.parse(req.body);
    const result = await claimPredictionService.predict({
      ...validatedData,
      createdBy: (req as any).user?._id,
    });
    
    req.entityType = 'claimPrediction';
    (req as any).claimPrediction = result;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async predictByClaimId(req: Request, res: Response) {
    if (!await serviceUtil.checkPermission(req, res, 'View', 'claim-predictions')) {
      req.statusCode = HTTP_STATUS.FORBIDDEN;
      req.errorMessage = t('auth.forbidden', {}, req.locale);
      return res.status(HTTP_STATUS.FORBIDDEN).json(respUtil.getErrorResponse(req));
    }
    const { claimId } = req.params;
    const results = await claimPredictionService.predictForClaim(
      claimId,
      (req as any).user?._id
    );
    
    req.entityType = 'claimPredictions';
    (req as any).claimPredictions = results;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async predictByChargeId(req: Request, res: Response) {
    if (!await serviceUtil.checkPermission(req, res, 'View', 'claim-predictions')) {
      req.statusCode = HTTP_STATUS.FORBIDDEN;
      req.errorMessage = t('auth.forbidden', {}, req.locale);
      return res.status(HTTP_STATUS.FORBIDDEN).json(respUtil.getErrorResponse(req));
    }
    const { chargeId } = req.params;
    const results = await claimPredictionService.predictForCharge(
      chargeId,
      (req as any).user?._id
    );
    
    req.entityType = 'claimPredictions';
    (req as any).claimPredictions = results;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async predictByEncounterId(req: Request, res: Response) {
    if (!await serviceUtil.checkPermission(req, res, 'View', 'claim-predictions')) {
      req.statusCode = HTTP_STATUS.FORBIDDEN;
      req.errorMessage = t('auth.forbidden', {}, req.locale);
      return res.status(HTTP_STATUS.FORBIDDEN).json(respUtil.getErrorResponse(req));
    }
    const { encounterId } = req.params;
    const results = await claimPredictionService.predictForEncounter(
      encounterId,
      (req as any).user?._id
    );
    
    req.entityType = 'claimPredictions';
    (req as any).claimPredictions = results;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async estimateByAppointmentId(req: Request, res: Response) {
    if (!await serviceUtil.checkPermission(req, res, 'View', 'claim-predictions')) {
      req.statusCode = HTTP_STATUS.FORBIDDEN;
      req.errorMessage = t('auth.forbidden', {}, req.locale);
      return res.status(HTTP_STATUS.FORBIDDEN).json(respUtil.getErrorResponse(req));
    }
    const { id } = req.params;
    const results = await claimPredictionService.estimateForAppointment(
      id,
      (req as any).user?._id
    );
    
    req.entityType = 'claimPredictions';
    (req as any).claimPredictions = results;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async list(req: Request, res: Response) {
    if (!await serviceUtil.checkPermission(req, res, 'View', 'claim-predictions')) {
      req.statusCode = HTTP_STATUS.FORBIDDEN;
      req.errorMessage = t('auth.forbidden', {}, req.locale);
      return res.status(HTTP_STATUS.FORBIDDEN).json(respUtil.getErrorResponse(req));
    }
    const query = await serviceUtil.generateListQuery(req, 'claimPrediction');
    const result = await claimPredictionService.list(query);
    
    req.entityType = 'claimPredictions';
    (req as any).claimPredictions = result.data;
    (req as any).pagination = {
      ...query.pagination,
      totalCount: result.total
    };
    return res.json(respUtil.getListSuccessResponse(req));
  }
}

export const claimPredictionController = new ClaimPredictionController();
