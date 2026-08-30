import { z } from 'zod';
import { SCREEN_KEYS } from './pageContent.model';

const screenKeyParam = z.object({
  screenKey: z.enum(SCREEN_KEYS),
});

const widgetSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['image', 'carousel', 'heading', 'text', 'button', 'spacer', 'socialLinks', 'announcementBanner']),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  })
  .passthrough();

export const getPageContentSchema = z.object({
  params: screenKeyParam,
});

export const saveDraftSchema = z.object({
  params: screenKeyParam,
  body: z.object({
    widgets: z.array(widgetSchema),
  }),
});

export const publishSchema = z.object({
  params: screenKeyParam,
});

export const listVersionsSchema = z.object({
  params: screenKeyParam,
});

export const restoreVersionSchema = z.object({
  params: screenKeyParam.extend({
    versionId: z.string().min(1),
  }),
});
