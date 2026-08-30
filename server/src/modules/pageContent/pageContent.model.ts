import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export const SCREEN_KEYS = [
  'home',
  'darshan',
  'seva',
  'accommodation',
  'prasadam',
  'donations',
  'facilities',
  'live',
  'events',
  'nearbyPlaces',
  'devoteeAuth',
] as const;

export type ScreenKey = (typeof SCREEN_KEYS)[number];

export type WidgetType =
  | 'image'
  | 'carousel'
  | 'heading'
  | 'text'
  | 'button'
  | 'spacer'
  | 'socialLinks'
  | 'announcementBanner';

export interface ICarouselImage {
  url: string;
  caption?: string;
  linkUrl?: string;
}

/**
 * A widget's shape varies by `type` (image widgets carry imageUrl, carousel
 * widgets carry images[], text/heading/button carry per-locale content,
 * etc.) — stored as Mixed rather than a rigid discriminated-union schema so
 * the widget palette can grow without a migration.
 */
export interface IWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  content?: Record<string, string>;
  imageUrl?: string;
  /** For `image` widgets — 'contain' avoids cropping a portrait photo that
   * doesn't match the widget box's aspect ratio; defaults to 'cover' for
   * every pre-existing widget/screen (unchanged behavior). */
  objectFit?: 'cover' | 'contain';
  linkUrl?: string;
  images?: ICarouselImage[];
  slideDurationMs?: number;
  transition?: 'fade' | 'slide';
  heightPx?: number;
}

/** A snapshot of `published` taken at the moment of a Publish action — see
 * pageContentService.publish(). Capped at MAX_VERSIONS (oldest dropped). */
export interface IPageContentVersion {
  id: string;
  widgets: IWidget[];
  publishedAt: Date;
}

export interface IPageContent extends BaseDocument {
  screenKey: ScreenKey;
  draft: IWidget[];
  published: IWidget[];
  versions: IPageContentVersion[];
  updated: Date;
}

const pageContentVersionSchema = new Schema(
  {
    id: { type: String, required: true },
    widgets: { type: [Schema.Types.Mixed], default: [] },
    publishedAt: { type: Date, required: true },
  },
  { _id: false }
);

const pageContentSchema = new Schema(
  {
    screenKey: { type: String, enum: SCREEN_KEYS, required: true, unique: true },
    draft: { type: [Schema.Types.Mixed], default: [] },
    published: { type: [Schema.Types.Mixed], default: [] },
    versions: { type: [pageContentVersionSchema], default: [] },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const PageContent = model<IPageContent>('PageContent', pageContentSchema);
