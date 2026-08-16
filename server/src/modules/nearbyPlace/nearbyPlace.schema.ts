import { z } from 'zod';

const categoryEnum = z.enum(['heritage', 'nature', 'shopping', 'food', 'accommodation', 'other']);

export const createNearbyPlaceSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    distanceKm: z.number().min(0),
    imageUrl: z.string().optional(),
    category: categoryEnum.optional(),
    mapLink: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateNearbyPlaceSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    distanceKm: z.number().min(0).optional(),
    imageUrl: z.string().optional(),
    category: categoryEnum.optional(),
    mapLink: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
