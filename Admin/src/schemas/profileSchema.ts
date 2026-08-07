import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
})

export type ProfileFormValues = z.infer<typeof profileSchema>
