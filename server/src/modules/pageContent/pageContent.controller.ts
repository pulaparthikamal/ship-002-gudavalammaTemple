import { Request, Response } from 'express';
import { pageContentService } from './pageContent.service';
import { ScreenKey } from './pageContent.model';

export const pageContentController = {
  async getPublished(req: Request, res: Response) {
    const widgets = await pageContentService.getPublished(req.params.screenKey as ScreenKey);
    return res.json({ widgets });
  },

  async getDraft(req: Request, res: Response) {
    const widgets = await pageContentService.getDraft(req.params.screenKey as ScreenKey);
    return res.json({ widgets });
  },

  async saveDraft(req: Request, res: Response) {
    const widgets = await pageContentService.saveDraft(req.params.screenKey as ScreenKey, req.body.widgets);
    return res.json({ widgets });
  },

  async publish(req: Request, res: Response) {
    const widgets = await pageContentService.publish(req.params.screenKey as ScreenKey);
    return res.json({ widgets });
  },

  async listVersions(req: Request, res: Response) {
    const versions = await pageContentService.listVersions(req.params.screenKey as ScreenKey);
    return res.json({ versions });
  },

  async restoreVersion(req: Request, res: Response) {
    const widgets = await pageContentService.restoreVersion(
      req.params.screenKey as ScreenKey,
      req.params.versionId
    );
    return res.json({ widgets });
  },
};
