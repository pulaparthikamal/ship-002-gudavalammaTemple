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
] as const

export type ScreenKey = (typeof SCREEN_KEYS)[number]

export const SCREEN_LABELS: Record<ScreenKey, string> = {
  home: 'Home',
  darshan: 'Darshan',
  seva: 'Seva',
  accommodation: 'Accommodation',
  prasadam: 'Prasadam',
  donations: 'Donations',
  facilities: 'Facilities',
  live: 'Live',
  events: 'Events',
  nearbyPlaces: 'Nearby Places',
}

export type WidgetType =
  | 'image'
  | 'carousel'
  | 'heading'
  | 'text'
  | 'button'
  | 'spacer'
  | 'socialLinks'
  | 'announcementBanner'

export interface CarouselImage {
  url: string
  caption?: string
  linkUrl?: string
}

export interface Widget {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number
  h: number
  content?: Record<string, string>
  imageUrl?: string
  linkUrl?: string
  images?: CarouselImage[]
  slideDurationMs?: number
  transition?: 'fade' | 'slide'
  heightPx?: number
}

export interface PageContentVersion {
  id: string
  widgets: Widget[]
  publishedAt: string
}

/** Real devotee-facing route each screen renders on — used by the Screen
 * Customizer's preview mode to load the actual page (nav/footer/booking UI
 * and all) inside an iframe, not just an isolated widget tree. */
export const SCREEN_PREVIEW_ROUTES: Record<ScreenKey, string> = {
  home: '/',
  darshan: '/devotee/darshan',
  seva: '/devotee/seva',
  accommodation: '/devotee/accommodation',
  prasadam: '/devotee/prasadam',
  donations: '/devotee/donations',
  facilities: '/devotee/facilities',
  live: '/devotee/live',
  events: '/devotee/events',
  nearbyPlaces: '/devotee/nearby-places',
}

export const WIDGET_PALETTE: Array<{ type: WidgetType; label: string; defaultW: number; defaultH: number }> = [
  { type: 'heading', label: 'Heading', defaultW: 6, defaultH: 2 },
  { type: 'text', label: 'Text block', defaultW: 6, defaultH: 2 },
  { type: 'image', label: 'Image', defaultW: 4, defaultH: 4 },
  { type: 'carousel', label: 'Image carousel', defaultW: 8, defaultH: 5 },
  { type: 'button', label: 'Button / CTA', defaultW: 3, defaultH: 1 },
  { type: 'socialLinks', label: 'Social links', defaultW: 4, defaultH: 1 },
  { type: 'announcementBanner', label: 'Announcement banner', defaultW: 12, defaultH: 2 },
  { type: 'spacer', label: 'Spacer', defaultW: 12, defaultH: 1 },
]
