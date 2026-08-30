import { z } from 'zod';

const catalogKeyEnum = z.enum([
  'seva',
  'darshan',
  'accommodation',
  'prasadam',
  'donationFund',
  'facility',
  'nearbyPlace',
  'templeEvent',
]);

export const resetCatalogSchema = z.object({
  body: z.object({
    catalog: catalogKeyEnum,
    mode: z.enum(['empty', 'defaults']),
  }),
});
