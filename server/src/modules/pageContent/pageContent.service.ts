import { Types } from 'mongoose';
import { PageContent, IWidget, IPageContentVersion, ScreenKey } from './pageContent.model';
import { languageService } from '../language/language.service';
import { translationService } from '../../services/translation/translation.service';
import { AppError } from '../../utils/error.util';

const MAX_VERSIONS = 20;

/**
 * For every widget with English content, fills in any ENABLED locale that's
 * currently missing from its `content` map — never overwrites a locale the
 * admin has already (auto-filled or manually) set, so manual overrides
 * survive subsequent saves.
 */
const autoFillTranslations = async (widgets: IWidget[]): Promise<IWidget[]> => {
  const enabledLanguages = await languageService.listEnabled();
  const targetLocales = enabledLanguages.map((lang) => lang.code).filter((code) => code !== 'en');

  for (const widget of widgets) {
    if (!widget.content?.en) continue;
    const missing = targetLocales.filter((locale) => !widget.content?.[locale]);
    if (!missing.length) continue;

    const translated = await translationService.translateToLocales(widget.content.en, 'en', missing);
    widget.content = { ...widget.content, ...translated };
  }

  return widgets;
};

export const pageContentService = {
  async getPublished(screenKey: ScreenKey): Promise<IWidget[]> {
    const doc = await PageContent.findOne({ screenKey });
    return (doc?.published as IWidget[]) ?? [];
  },

  async getDraft(screenKey: ScreenKey): Promise<IWidget[]> {
    const doc = await PageContent.findOne({ screenKey });
    return (doc?.draft as IWidget[]) ?? [];
  },

  async saveDraft(screenKey: ScreenKey, widgets: IWidget[]): Promise<IWidget[]> {
    const withTranslations = await autoFillTranslations(widgets);

    const doc = await PageContent.findOneAndUpdate(
      { screenKey },
      { $set: { draft: withTranslations, updated: new Date() }, $setOnInsert: { screenKey, published: [] } },
      { upsert: true, new: true }
    );

    return doc.draft as IWidget[];
  },

  async publish(screenKey: ScreenKey): Promise<IWidget[]> {
    const doc = await PageContent.findOne({ screenKey });
    if (!doc) {
      const created = await PageContent.create({ screenKey, draft: [], published: [] });
      return created.published as IWidget[];
    }

    doc.published = doc.draft;
    doc.updated = new Date();

    const version: IPageContentVersion = {
      id: new Types.ObjectId().toString(),
      widgets: doc.published as IWidget[],
      publishedAt: doc.updated,
    };
    doc.versions = [...((doc.versions as IPageContentVersion[]) ?? []), version].slice(-MAX_VERSIONS);

    await doc.save();
    return doc.published as IWidget[];
  },

  /** Newest first. */
  async listVersions(screenKey: ScreenKey): Promise<IPageContentVersion[]> {
    const doc = await PageContent.findOne({ screenKey });
    return [...((doc?.versions as IPageContentVersion[]) ?? [])].reverse();
  },

  /**
   * Copies a historical version's widgets into `draft` for review — never
   * overwrites `published` directly, so the existing "review before it goes
   * live" flow (Save Draft -> Preview -> Publish) still applies to a restore.
   */
  async restoreVersion(screenKey: ScreenKey, versionId: string): Promise<IWidget[]> {
    const doc = await PageContent.findOne({ screenKey });
    const version = (doc?.versions as IPageContentVersion[] | undefined)?.find((v) => v.id === versionId);
    if (!doc || !version) {
      throw new AppError('Version not found', 404);
    }

    doc.draft = version.widgets;
    doc.updated = new Date();
    await doc.save();
    return doc.draft as IWidget[];
  },
};
