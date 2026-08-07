import { Request, Response } from 'express';
import * as automationService from './automation.service';
import respUtil from '../../utils/resp.util';

export const createAutomation = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const automation = await automationService.createAutomation({ ...req.body, userId });
  
  req.entityType = 'automation';
  (req as any).automation = automation;
  
  return res.json(respUtil.createSuccessResponse(req));
};

export const getAutomations = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  
  let filters: any = {};
  let page = 1;
  let limit = 20;
  let sortfield = 'createdAt';
  let direction = 'desc';

  if (req.query.filter) {
    try {
      const parsedFilter = JSON.parse(req.query.filter as string);
      page = parsedFilter.page || 1;
      limit = parsedFilter.limit || 20;
      sortfield = parsedFilter.sortfield || 'createdAt';
      direction = parsedFilter.direction || 'desc';
      
      if (parsedFilter.criteria && Array.isArray(parsedFilter.criteria)) {
        parsedFilter.criteria.forEach((c: any) => {
          if (c.key && c.value !== undefined && c.value !== null) {
            filters[c.key] = c.value;
          }
        });
      }
    } catch (e) {
      console.error('Error parsing filter query:', e);
    }
  }

  const result = await automationService.getAutomationsPaged(userId, filters, page, limit, sortfield, direction);
  
  req.entityType = 'automation';
  (req as any).automation = result.automations;
  (req as any).pagination = {
    page,
    limit,
    totalCount: result.total
  };
  
  return res.json(respUtil.getListSuccessResponse(req));
};


export const updateAutomation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const automation = await automationService.updateAutomation(id, req.body);
  
  req.entityType = 'automation';
  (req as any).automation = automation;
  
  return res.json(respUtil.updateSuccessResponse(req));
};

export const deleteAutomation = async (req: Request, res: Response) => {
  const { id } = req.params;
  await automationService.deleteAutomation(id);
  
  req.entityType = 'automation';
  
  return res.json(respUtil.removeSuccessResponse(req));
};

export const togglePause = async (req: Request, res: Response) => {
  const { id } = req.params;
  const automation = await automationService.toggleAutomationPause(id);
  
  req.entityType = 'automation';
  (req as any).automation = automation;
  
  return res.json(respUtil.updateSuccessResponse(req));
};


