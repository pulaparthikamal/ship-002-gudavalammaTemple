import { z } from 'zod';

const propertyType = z.enum(['land', 'building', 'vehicle', 'jewellery', 'other']);
const propertyStatus = z.enum(['active', 'disputed', 'sold']);

export const createPropertySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    type: propertyType,
    location: z.string().optional(),
    areaSqft: z.number().optional(),
    acquisitionDate: z.coerce.date().optional(),
    estimatedValue: z.number().optional(),
    documentRefs: z.array(z.string()).optional(),
    status: propertyStatus.optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updatePropertySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    type: propertyType.optional(),
    location: z.string().optional(),
    areaSqft: z.number().optional(),
    acquisitionDate: z.coerce.date().optional(),
    estimatedValue: z.number().optional(),
    documentRefs: z.array(z.string()).optional(),
    status: propertyStatus.optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
