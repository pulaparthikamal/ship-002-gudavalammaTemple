import { Request, Response } from 'express';
import * as categoryService from './category.service';
import respUtil from '../../utils/resp.util';

export const createCategory = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const category = await categoryService.createCategory({ ...req.body, userId });
  
  req.entityType = 'category';
  (req as any).category = category;
  
  return res.json(respUtil.createSuccessResponse(req));
};

export const getCategories = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const categories = await categoryService.getCategories(userId);
  
  req.entityType = 'category';
  (req as any).category = categories;
  
  return res.json(respUtil.getListSuccessResponse(req));
};

export const getAudienceSuggestions = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const audienceSuggestions = await categoryService.getAudienceSuggestions(userId);

  req.entityType = 'audienceSuggestions';
  (req as any).audienceSuggestions = audienceSuggestions;

  return res.json(respUtil.dataSuccessResponse(req, audienceSuggestions));
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await categoryService.updateCategory(id, req.body);
  
  req.entityType = 'category';
  (req as any).category = category;
  
  return res.json(respUtil.updateSuccessResponse(req));
};

export const deleteAudienceSuggestion = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  await categoryService.deleteAudienceSuggestion(userId, req.params.value);

  req.entityType = 'audienceSuggestion';

  return res.json(respUtil.removeSuccessResponse(req));
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  await categoryService.deleteCategory(id);
  
  req.entityType = 'category';
  
  return res.json(respUtil.removeSuccessResponse(req));
};
