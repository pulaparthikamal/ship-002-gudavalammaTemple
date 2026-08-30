import { Request, Response } from 'express';
import { navTabService } from './navTab.service';
import { NavTabRole } from './navTab.model';

export const navTabController = {
  async listEnabled(req: Request, res: Response) {
    const user: any = req.user;
    const role: NavTabRole = user?.role?.role === 'USER' ? 'USER' : 'GUEST';
    const navTabs = await navTabService.listEnabledForRole(role);
    return res.json({ navTabs });
  },

  async listAll(req: Request, res: Response) {
    const navTabs = await navTabService.listAll();
    return res.json({ navTabs });
  },

  async setAllowedRoles(req: Request, res: Response) {
    const navTab = await navTabService.setAllowedRoles(req.params.key, req.body.allowedRoles, req.locale || 'en');
    return res.json({ navTab });
  },
};
