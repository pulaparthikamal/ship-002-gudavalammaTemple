/**
 * The 6 concrete funnels instrumented on the devotee frontend (see
 * Admin/src/utils/analytics.ts callers). Not a generic funnel builder —
 * these names/step shapes must match what the frontend actually sends.
 */
export const FUNNEL_NAMES = [
  'darshan_booking',
  'seva_booking',
  'accommodation_booking',
  'prasadam_order',
  'donation',
  'event_registration',
] as const;

export type FunnelName = (typeof FUNNEL_NAMES)[number];

/**
 * Every click target label the frontend is instrumented to send (nav links +
 * dashboard quick-action cards). Used to compute "used vs never-used
 * features" by cross-referencing against actual click counts — anything in
 * this list with zero recorded clicks is a real, known feature nobody has
 * used, not a typo in a label string.
 */
export const INSTRUMENTED_CLICK_LABELS = [
  'nav_darshan',
  'nav_seva',
  'nav_accommodation',
  'nav_prasadam',
  'nav_donations',
  'nav_live',
  'nav_bookings',
  'nav_facilities',
  'nav_events',
  'nav_nearby_places',
  'quickaction_darshan',
  'quickaction_seva',
  'quickaction_accommodation',
  'quickaction_prasadam',
  'quickaction_donations',
  'quickaction_events',
  'quickaction_live',
  'quickaction_bookings',
  'quickaction_facilities',
  'quickaction_nearby_places',
] as const;
