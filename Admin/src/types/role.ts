import type { CrudPermissionAction, CrudPermissionsValue } from './crud'

export type RoleStatus = 'Active' | 'Inactive' | 'Pending'

export type RoleType = 'User' | 'Manager' | 'Admin' | 'Super Admin' | 'Guest'

export interface RolePermissionPayloadEntry {
  type: 'NoView' | 'View' | 'Edit'
  actions: CrudPermissionAction[]
}

export type RolePermissionPayload = Record<string, RolePermissionPayloadEntry>

export interface Role {
  _id: string
  role: string
  roleType: RoleType
  status: RoleStatus
  active?: boolean
  permissions: CrudPermissionsValue
  createdAt: string
  updatedAt: string
  __v?: number
}

export interface RoleFormValues {
  _id?: string
  role: string
  roleType: RoleType
  status: RoleStatus
  permissions: CrudPermissionsValue
}

export interface RoleCreatePayload {
  role: string
  roleType: RoleType
  status: RoleStatus
  permissions: RolePermissionPayload
}

export type RoleUpdatePayload = RoleCreatePayload
