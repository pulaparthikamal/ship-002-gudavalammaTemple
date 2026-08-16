import { Request, Response } from 'express';
import { languageService } from './language.service';
import { translationService } from '../../services/translation/translation.service';

export const languageController = {
  async listAll(req: Request, res: Response) {
    const languages = await languageService.listAll();
    return res.json({ languages });
  },

  async listEnabled(req: Request, res: Response) {
    const languages = await languageService.listEnabled();
    return res.json({ languages });
  },

  async setEnabled(req: Request, res: Response) {
    const language = await languageService.setEnabled(req.params.code, req.body.enabled, req.locale || 'en');

    if (req.body.enabled) {
      // Fire-and-forget: populate the translation cache for this language
      // in the background so enabling it isn't blocked on translating
      // everything up front.
      translationService.populateLocale(language.code).catch(() => undefined);
    }

    return res.json({ language });
  },
};
