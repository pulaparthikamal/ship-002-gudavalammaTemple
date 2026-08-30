export interface Donor {
  _id: string
  name: string
  phone?: string
  email?: string
  address?: string
  panNumber?: string
  linkedUserId?: string
  notes?: string
  active: boolean
  created: string
  updated: string
}

export interface DonorFormValues {
  _id?: string
  name: string
  phone: string
  email: string
  address: string
  panNumber: string
  linkedUserId: string
  notes: string
  active: boolean
}

export interface DonorCreatePayload {
  name: string
  phone?: string
  email?: string
  address?: string
  panNumber?: string
  linkedUserId?: string
  notes?: string
  active: boolean
}

export type DonorUpdatePayload = DonorCreatePayload
