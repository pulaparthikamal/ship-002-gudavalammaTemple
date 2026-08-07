import { Request, Response } from 'express';
import { feeScheduleService } from './fee-schedule.service';
import { feeScheduleLookupSchema, feeScheduleSchema, updateFeeScheduleSchema } from './fee-schedule.schema';
import respUtil from '../../../utils/resp.util';

const feeScheduleListFilterFields = [
  'payerId',
  'cptCode',
  'providerId',
  'facilityId',
  'state',
  'placeOfServiceCode',
  'planName',
  'groupNumber',
  'network',
  'coverageType',
  'active',
] as const;

function readListQuery(query: Request['query']) {
  const rawFilter = typeof query.filter === 'string'
    ? JSON.parse(query.filter)
    : typeof query.filter === 'object' && query.filter !== null
      ? query.filter
      : query;
  const source = rawFilter as Record<string, any>;
  const page = Number(source.page ?? query.page ?? 1);
  const limit = Number(source.limit ?? query.limit ?? 10);
  const sortfield = String(source.sortfield ?? source.sort ?? query.sortfield ?? query.sort ?? 'created');
  const direction = String(source.direction ?? source.order ?? query.direction ?? query.order ?? 'desc');
  const filter: Record<string, unknown> = {};

  feeScheduleListFilterFields.forEach((field) => {
    const value = source[field] ?? query[field];
    if (value === undefined || value === null || value === '') {
      return;
    }
    filter[field] = field === 'active' ? value === true || value === 'true' : value;
  });

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 10,
    sorting: { [sortfield]: direction === 'asc' ? 1 : -1 },
    filter,
  };
}

export class FeeScheduleController {
  async create(req: Request, res: Response) {
    const validatedData = feeScheduleSchema.parse(req.body);
    const result = await feeScheduleService.create({ ...validatedData, createdBy: (req as any).user?._id });
    
    req.entityType = 'feeSchedule';
    (req as any).feeSchedule = result;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async getById(req: Request, res: Response) {
    const result = await feeScheduleService.getById(req.params.id);
    if (!result) {
      req.errorMessage = 'Fee schedule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'feeSchedule';
    (req as any).feeSchedule = result;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  }

  async update(req: Request, res: Response) {
    const validatedData = updateFeeScheduleSchema.parse(req.body);
    const result = await feeScheduleService.update(req.params.id, { ...validatedData, updatedBy: (req as any).user?._id });
    if (!result) {
      req.errorMessage = 'Fee schedule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'feeSchedule';
    (req as any).feeSchedule = result;
    return res.json(respUtil.updateSuccessResponse(req));
  }

  async delete(req: Request, res: Response) {
    const result = await feeScheduleService.delete(req.params.id);
    if (!result) {
      req.errorMessage = 'Fee schedule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'feeSchedule';
    return res.json(respUtil.removeSuccessResponse(req));
  }

  async list(req: Request, res: Response) {
    const criteria = readListQuery(req.query);
    const result = await feeScheduleService.list(criteria);
    
    req.entityType = 'feeSchedules';
    (req as any).feeSchedules = result.data;
    (req as any).pagination = {
      page: criteria.page,
      limit: criteria.limit,
      totalCount: result.total
    };
    return res.json(respUtil.getListSuccessResponse(req));
  }

  async lookup(req: Request, res: Response) {
    const validatedData = feeScheduleLookupSchema.parse({ body: req.body }).body;
    const result = await feeScheduleService.findBestMatchDetailed({
      payerIds: [validatedData.payerId],
      cptCode: validatedData.cptCode,
      modifiers: validatedData.modifiers,
      providerId: validatedData.providerId,
      facilityId: validatedData.facilityId,
      state: validatedData.state,
      placeOfServiceCode: validatedData.placeOfServiceCode,
      planName: validatedData.planName,
      groupNumber: validatedData.groupNumber,
      network: validatedData.network,
      coverageType: validatedData.coverageType,
      serviceDate: validatedData.serviceDate,
    });

    return res.json(respUtil.dataSuccessResponse(
      req,
      result
        ? {
            allowedAmount: result.allowedAmount,
            feeScheduleId: result.feeScheduleId,
            matchedBy: result.matchedBy,
            source: result.source,
            confidence: result.confidence,
            effectiveDate: result.effectiveDate,
            expiryDate: result.expiryDate,
          }
        : null,
      result ? 'Fee schedule match found.' : 'No matching fee schedule found.'
    ));
  }
}

export const feeScheduleController = new FeeScheduleController();
