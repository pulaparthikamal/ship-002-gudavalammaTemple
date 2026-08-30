import { z } from 'zod';

export const updateTempleProfileSchema = z.object({
  body: z.object({
    templeName: z.string().min(1).optional(),
    tagline: z.string().optional(),
    address: z.string().optional(),
    helpline: z.string().optional(),
    logoUrl: z.string().optional(),
    deityImageUrl: z.string().optional(),
    upiId: z.string().optional(),
    socialLinks: z
      .object({
        facebook: z.string().optional(),
        instagram: z.string().optional(),
        youtube: z.string().optional(),
        twitter: z.string().optional(),
        whatsapp: z.string().optional(),
      })
      .optional(),
    timings: z
      .array(
        z.object({
          label: z.string().min(1),
          time: z.string().min(1),
        })
      )
      .optional(),
    contactEmails: z.array(z.string().email()).optional(),
  }),
});
