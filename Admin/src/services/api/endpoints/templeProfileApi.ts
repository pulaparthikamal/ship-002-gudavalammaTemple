import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export interface TempleSocialLinks {
  facebook?: string
  instagram?: string
  youtube?: string
  twitter?: string
  whatsapp?: string
}

export interface TempleTiming {
  label: string
  time: string
}

export interface TempleProfile {
  _id: string
  templeName: string
  tagline?: string
  address?: string
  helpline?: string
  logoUrl?: string
  /** The large deity/idol photo — used for the login pages' artwork panel
   * and the devotee home hero, as distinct from `logoUrl` (the small brand
   * mark shown in headers/sidebars/nav). */
  deityImageUrl?: string
  upiId?: string
  /** Auto-filled translation of `templeName` per enabled locale (see
   * resolveTempleName in @/utils/templeName.ts for how to read this). */
  nameTranslations?: Record<string, string>
  socialLinks: TempleSocialLinks
  timings: TempleTiming[]
  contactEmails: string[]
}

export interface TempleProfilePayload {
  templeName?: string
  tagline?: string
  address?: string
  helpline?: string
  logoUrl?: string
  deityImageUrl?: string
  upiId?: string
  socialLinks?: TempleSocialLinks
  timings?: TempleTiming[]
  contactEmails?: string[]
}

export const templeProfileApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTempleProfile: builder.query<TempleProfile, void>({
      query: () => ({
        url: '/temple-profile',
        method: 'GET',
      }),
      transformResponse: (response: unknown) => readResponsePath<TempleProfile>(response, 'templeProfile'),
      providesTags: [{ type: 'TempleProfile' as const, id: 'SINGLETON' }],
    }),
    updateTempleProfile: builder.mutation<TempleProfile, TempleProfilePayload>({
      query: (payload) => ({
        url: '/temple-profile',
        method: 'PUT',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<TempleProfile>(response, 'templeProfile'),
      invalidatesTags: [{ type: 'TempleProfile' as const, id: 'SINGLETON' }],
    }),
  }),
})

export const { useGetTempleProfileQuery, useUpdateTempleProfileMutation } = templeProfileApi
