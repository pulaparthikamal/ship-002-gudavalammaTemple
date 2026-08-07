import { Request, Response } from 'express';
import * as socialAccountService from './socialAccount.service';
import respUtil from '../../utils/resp.util';

export const connectAccount = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const { platform } = req.params;
  const account = await socialAccountService.connectAccount({ ...req.body, userId, platform: platform as any });
  
  req.entityType = 'socialAccount';
  (req as any).socialAccount = account;
  
  return res.json(respUtil.createSuccessResponse(req));
};

export const getAccounts = async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const accounts = await socialAccountService.getAccounts(userId);
  
  req.entityType = 'socialAccount';
  (req as any).socialAccount = accounts;
  
  return res.json(respUtil.getListSuccessResponse(req));
};

export const disconnectAccount = async (req: Request, res: Response) => {
  const { id } = req.params;
  await socialAccountService.disconnectAccount(id);
  
  req.entityType = 'socialAccount';
  
  return res.json(respUtil.removeSuccessResponse(req));
};

export const updateAccount = async (req: Request, res: Response) => {
  const { id } = req.params;
  const account = await socialAccountService.updateAccount(id, req.body);
  
  req.entityType = 'socialAccount';
  (req as any).socialAccount = account;
  
  return res.json(respUtil.updateSuccessResponse(req));
};

