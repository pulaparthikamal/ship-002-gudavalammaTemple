import { Request, Response } from 'express';
import { credentialService } from '../services/credential.service';
import { getRequestUserId } from '../../serverManagement/utils/user.util';

export const credentialController = {
  async create(req: Request, res: Response) {
    const credential = await credentialService.create(req.body, getRequestUserId(req));
    return res.status(201).json({ success: true, data: credential, message: 'Credential created.' });
  },

  async list(req: Request, res: Response) {
    const credentials = await credentialService.list(getRequestUserId(req));
    return res.json({ success: true, data: credentials });
  },

  async update(req: Request, res: Response) {
    const credential = await credentialService.update(req.params.id, req.body, getRequestUserId(req));
    return res.json({ success: true, data: credential, message: 'Credential updated.' });
  },

  async remove(req: Request, res: Response) {
    await credentialService.remove(req.params.id, getRequestUserId(req));
    return res.json({ success: true, data: null, message: 'Credential deleted.' });
  },
};
