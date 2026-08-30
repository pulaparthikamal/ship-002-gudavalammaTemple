import { Request, Response } from 'express';
import { templeReconfigureService } from './templeReconfigure.service';

export const templeReconfigureController = {
  async listCatalogs(req: Request, res: Response) {
    const catalogs = await templeReconfigureService.listCatalogs();
    return res.json({ catalogs });
  },

  async resetCatalog(req: Request, res: Response) {
    const { catalog, mode } = req.body as { catalog: any; mode: 'empty' | 'defaults' };
    const result = await templeReconfigureService.resetCatalog(catalog, mode, req.locale || 'en');
    return res.json({ result });
  },
};
