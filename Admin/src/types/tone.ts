import type { EntityId } from './common'

export interface Tone {
  _id: EntityId
  name: string
  active: boolean
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export interface ToneCreatePayload {
  name: string
  active?: boolean
}
