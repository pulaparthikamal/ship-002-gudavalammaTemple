import { Request, Response } from 'express';
import { ruleService } from './rule.service';
import { ruleSchema, updateRuleSchema } from './rule.schema';
import respUtil from '../../../utils/resp.util';

export class RuleController {
  async create(req: Request, res: Response) {
    const validatedData = ruleSchema.parse(req.body);
    const result = await ruleService.create({ ...validatedData, createdBy: (req as any).user?._id });
    
    req.entityType = 'rule';
    (req as any).rule = result;
    return res.json(respUtil.createSuccessResponse(req));
  }

  async getById(req: Request, res: Response) {
    const result = await ruleService.getById(req.params.id);
    if (!result) {
      req.errorMessage = 'Rule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'rule';
    (req as any).rule = result;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  }

  async update(req: Request, res: Response) {
    const validatedData = updateRuleSchema.parse(req.body);
    const result = await ruleService.update(req.params.id, { ...validatedData, updatedBy: (req as any).user?._id });
    if (!result) {
      req.errorMessage = 'Rule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'rule';
    (req as any).rule = result;
    return res.json(respUtil.updateSuccessResponse(req));
  }

  async delete(req: Request, res: Response) {
    const result = await ruleService.delete(req.params.id);
    if (!result) {
      req.errorMessage = 'Rule not found';
      req.statusCode = 404;
      return res.status(404).json(respUtil.getErrorResponse(req));
    }
    
    req.entityType = 'rule';
    return res.json(respUtil.removeSuccessResponse(req));
  }

  async list(req: Request, res: Response) {
    const { page = 1, limit = 10, sort = 'created', order = 'desc', ...filter } = req.query;
    const criteria = {
      page: Number(page),
      limit: Number(limit),
      sorting: { [sort as string]: order === 'desc' ? -1 : 1 },
      filter,
    };
    const result = await ruleService.list(criteria);
    
    req.entityType = 'rules';
    (req as any).rules = result.data;
    (req as any).pagination = {
      page: criteria.page,
      limit: criteria.limit,
      totalCount: result.total
    };
    return res.json(respUtil.getListSuccessResponse(req));
  }
}

export const ruleController = new RuleController();
