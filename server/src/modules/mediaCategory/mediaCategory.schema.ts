import { z } from 'zod';

const platformEnableSchema = z.record(z.boolean());

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(24, 'ID must be at least 24 characters'),
  }),
});

export const createMediaCategorySchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'Name is required',
    }).min(2, 'Name must be at least 2 characters'),
    content: z.string().nullish(),
    videoUrl: z.string().url('Please enter a valid URL').nullish(),
    imageUrl: z.string().url('Please enter a valid image URL').nullish(),
    description: z.string().nullish(),
    interestedTopics: z.array(z.string()).nullish(),
    frequencyOfPublishing: z.number().int().min(1).nullish(),
    tone: z.string().nullish(),
    platform: z.string().nullish(),
    enable: platformEnableSchema.nullish(),
    scheduledDate: z.string().datetime().nullish(),
    active: z.boolean().nullish(),
  }),
});

export const updateMediaCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').nullish(),
    content: z.string().nullish(),
    videoUrl: z.string().url('Please enter a valid URL').or(z.literal('')).nullish(),
    imageUrl: z.string().url('Please enter a valid image URL').or(z.literal('')).nullish(),
    description: z.string().nullish(),
    interestedTopics: z.array(z.string()).nullish(),
    frequencyOfPublishing: z.number().int().min(1).nullish(),
    tone: z.string().nullish(),
    platform: z.string().nullish(),
    enable: platformEnableSchema.nullish(),
    scheduledDate: z.string().datetime().nullish(),
    active: z.boolean().nullish(),
  }),
  params: z.object({
    id: z.string().min(24, 'ID must be at least 24 characters'),
  }),
});

export const updateMediaCategoryStatusSchema = z.object({
  body: z.object({
    active: z.boolean({
      required_error: 'Status is required',
    }),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
