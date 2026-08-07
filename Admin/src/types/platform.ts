import type { EntityId } from './common'

export interface Platform {
  _id: EntityId
  name: string
  icon?: string
  color?: string
  svg?: string
  active: boolean
}

export interface PlatformCreatePayload {
  name: string
  icon?: string
  active?: boolean
}
