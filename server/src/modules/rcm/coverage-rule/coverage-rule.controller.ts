import { Request, Response } from 'express';
import respUtil from '../../../utils/resp.util';
import { coverageRuleService } from './coverage-rule.service';
import {
  coverageRuleSchema,
  evaluateCoverageRuleSchema,
  updateCoverageRuleSchema,
} from './coverage-rule.schema';

const coverageRuleListFilterFields = [
  'payerId',
  'planName',
  'groupNumber',
  'state',
  'facilityId',
  'providerId',
  'cptCode',
  'placeOfServiceCode',
  'network',
  'coverageType',
  'ruleType',
  'activeFlag',
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

  coverageRuleListFilterFields.forEach((field) => {
    const value = source[field] ?? query[field];
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (field === 'active' || field === 'activeFlag') {
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

export const coverageRuleController = {
  async create(req: Request, res: Response) {
    const validatedData = coverageRuleSchema.parse(req.body);
    const result = await coverageRuleService.create({ ...validatedData, createdBy: (req as any).user?._id });

    req.entityType = 'coverageRule';
    (req as any).coverageRule = result;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const result = await coverageRuleService.getById(req.params.id);
    if (!result) {
      req.errorMessage = 'Coverage rule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }

    req.entityType = 'coverageRule';
    (req as any).coverageRule = result;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const validatedData = updateCoverageRuleSchema.parse(req.body);
    const result = await coverageRuleService.update(req.params.id, { ...validatedData, updatedBy: (req as any).user?._id });
    if (!result) {
      req.errorMessage = 'Coverage rule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }

    req.entityType = 'coverageRule';
    (req as any).coverageRule = result;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const result = await coverageRuleService.delete(req.params.id);
    if (!result) {
      req.errorMessage = 'Coverage rule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }

    req.entityType = 'coverageRule';
    return res.json(respUtil.removeSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    const criteria = readListQuery(req.query);
    const result = await coverageRuleService.list(criteria);

    req.entityType = 'coverageRules';
    (req as any).coverageRules = result.data;
    (req as any).pagination = {
      page: criteria.page,
      limit: criteria.limit,
      totalCount: result.total,
    };
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async evaluate(req: Request, res: Response) {
    const validatedData = evaluateCoverageRuleSchema.parse({ body: req.body }).body;
    const result = await coverageRuleService.evaluateCoverageRules(validatedData);
    return res.json(respUtil.dataSuccessResponse(req, result, 'Coverage rules evaluated.'));
  },
};
