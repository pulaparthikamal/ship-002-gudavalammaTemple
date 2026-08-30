export type PropertyType = 'land' | 'building' | 'vehicle' | 'jewellery' | 'other'
export type PropertyStatus = 'active' | 'disputed' | 'sold'

export interface Property {
  _id: string
  name: string
  type: PropertyType
  location?: string
  areaSqft?: number
  acquisitionDate?: string
  estimatedValue: number
  documentRefs?: string[]
  status: PropertyStatus
  notes?: string
  active: boolean
  created: string
  updated: string
}

export interface PropertyFormValues {
  _id?: string
  name: string
  type: PropertyType
  location: string
  areaSqft?: number
  acquisitionDate: Date | string | null
  estimatedValue: number
  status: PropertyStatus
  notes: string
  active: boolean
}

export interface PropertyCreatePayload {
  name: string
  type: PropertyType
  location?: string
  areaSqft?: number
  acquisitionDate?: string
  estimatedValue: number
  status: PropertyStatus
  notes?: string
  active: boolean
}

export type PropertyUpdatePayload = PropertyCreatePayload
