import { Request, Response } from 'express';
import { translationService } from '../../services/translation/translation.service';

export const translationController = {
  async translateEntries(req: Request, res: Response) {
    const { locale } = req.params;
    const { entries } = req.body as { entries: Array<{ key: string; text: string }> };
    const translations = await translationService.translateEntries(entries, locale);
    return res.json({ translations });
  },
};
