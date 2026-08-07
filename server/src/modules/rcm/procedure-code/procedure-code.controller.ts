import { Request, Response } from 'express';
import { procedureCodeService } from './procedure-code.service';
import { procedureCodeSchema, updateProcedureCodeSchema } from './procedure-code.schema';
import respUtil from '../../../utils/resp.util';

const procedureCodeListFilterFields = [
  'code',
  'description',
  'category',
  'requiresAuth',
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

  procedureCodeListFilterFields.forEach((field) => {
    const value = source[field] ?? query[field];
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (field === 'active' || field === 'requiresAuth') {
      filter[field] = value === true || value === 'true';
      return;
    }

    filter[field] = value;
  });

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 10,
    sorting: { [sortfield]: direction === 'asc' ? 1 : -1 },
    filter,
  };
}

export class ProcedureCodeController {
  async create(req: Request, res: Response) {
    const validatedData = procedureCodeSchema.parse(req.body);
    const result = await procedureCodeService.create({ ...validatedData, createdBy: (req as any).user?._id });
    
    req.entityType = 'procedureCode';
    (req as any).procedureCode = result;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async getById(req: Request, res: Response) {
    const result = await procedureCodeService.getById(req.params.id);
    if (!result) {
      req.errorMessage = 'Procedure code not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'procedureCode';
    (req as any).procedureCode = result;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  }

  async update(req: Request, res: Response) {
    const validatedData = updateProcedureCodeSchema.parse(req.body);
    const result = await procedureCodeService.update(req.params.id, { ...validatedData, updatedBy: (req as any).user?._id });
    if (!result) {
      req.errorMessage = 'Procedure code not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'procedureCode';
    (req as any).procedureCode = result;
    return res.json(respUtil.updateSuccessResponse(req));
  }

  async delete(req: Request, res: Response) {
    const result = await procedureCodeService.delete(req.params.id);
    if (!result) {
      req.errorMessage = 'Procedure code not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'procedureCode';
    return res.json(respUtil.removeSuccessResponse(req));
  }

  async list(req: Request, res: Response) {
    const criteria = readListQuery(req.query);
    const result = await procedureCodeService.list(criteria);
    
    req.entityType = 'procedureCodes';
    (req as any).procedureCodes = result.data;
    (req as any).pagination = {
      page: criteria.page,
      limit: criteria.limit,
      totalCount: result.total
    };
    return res.json(respUtil.getListSuccessResponse(req));
  }
}

export const procedureCodeController = new ProcedureCodeController();
