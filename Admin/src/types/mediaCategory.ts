import type { EntityId } from './common'
import type { CreatorResearchInformation } from './social'

export type SocialMediaPlatformEnable = Record<string, boolean>

export interface MediaCategory {
  _id: EntityId
  updatedAt: string | null | undefined
  createdAt: string | null | undefined
  name: string
  content?: string
  videoUrl?: string
  imageUrl?: string
  description?: string
  interestedTopics?: string[]
  additionalInformation?: CreatorResearchInformation | null
  frequencyOfPublishing?: number
  topicUrls?: string[]
  categoryUrls?: string[]
  active: boolean
  isUploaded?: boolean
  scheduledDate?: string
  tone?: string
  platform?: string
  enable?: SocialMediaPlatformEnable
}

export interface MediaCategoryFormValues {
  _id?: EntityId
  name: string
  content: string
  videoUrl: string
  imageUrl: string
  description: string
  interestedTopics: string | string[]
  frequencyOfPublishing: number | ''
  scheduledDate: string | Date | null
  active: boolean
  tone: string
  platform: string
  categoryUrls?: string[]
}

export interface MediaCategoryCreatePayload {
  name: string
  content?: string
  videoUrl?: string
  imageUrl?: string
  description?: string
  interestedTopics?: string[]
  frequencyOfPublishing?: number
  scheduledDate?: string | null
  active: boolean
  tone?: string
  categoryUrls?: string[]
  enable?: SocialMediaPlatformEnable
}

export interface MediaCategoryUpdatePayload {
  name?: string
  content?: string | null
  videoUrl?: string | null
  imageUrl?: string | null
  description?: string | null
  interestedTopics?: string[] | null
  frequencyOfPublishing?: number | null
  scheduledDate?: string | null
  active?: boolean
  tone?: string | null
  categoryUrls?: string[] | null
  enable?: SocialMediaPlatformEnable
}
