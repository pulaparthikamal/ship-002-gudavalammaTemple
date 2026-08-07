export interface UserRole {
  _id: string
  role?: string
  roleType?: string
  status?: string
  active?: boolean
  permissions?: Record<string, unknown>
}

export type UserRoleReference = string | UserRole

export interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  password?: string
  phone?: string
  profileImage?: string
  role: UserRoleReference
  isActive: boolean
  isEmailVerified: boolean
  createdBy?: string
  updatedBy?: string
  isDeleted: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  __v?: number
}

export interface UserFormValues {
  _id?: string
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  profileImage: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
}

export interface UserCreatePayload {
  firstName: string
  lastName: string
  email: string
  password: string
  phone?: string
  profileImage?: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
}

export interface UserUpdatePayload {
  firstName: string
  lastName: string
  email: string
  password?: string
  phone?: string
  profileImage?: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
}
