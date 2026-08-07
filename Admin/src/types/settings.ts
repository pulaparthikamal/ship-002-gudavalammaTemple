import type { EntityId } from './common'

export interface Setting {
  _id: EntityId
  key: string
  value: any
  group?: string
  label?: string
  isPublic: boolean
  isEditable: boolean
  active: boolean
  created: string
  updated: string
}

export interface SettingUpdatePayload {
  value: any
}
