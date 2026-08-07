export interface Facility {
  _id: string
  facilityId: string
  facilityName?: string
  facilityCode?: string
  npi?: string
  taxId?: string
  placeOfServiceCode?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  fax?: string
  activeFlag: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface FacilityFormValues {
  _id?: string
  facilityName: string
  facilityCode: string
  npi: string
  taxId: string
  placeOfServiceCode: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  phone: string
  fax: string
  activeFlag: boolean
  active: boolean
}

export interface FacilityCreatePayload {
  facilityName?: string
  facilityCode?: string
  npi?: string
  taxId?: string
  placeOfServiceCode?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  fax?: string
  activeFlag: boolean
  active: boolean
}

export type FacilityUpdatePayload = FacilityCreatePayload
