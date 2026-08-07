export interface Provider {
  _id: string
  providerId: string
  firstName?: string
  lastName?: string
  credentials?: string
  specialty?: string
  npi?: string
  taxId?: string
  taxonomyCode?: string
  licenseNumber?: string
  deaNumber?: string
  providerType?: string
  phone?: string
  fax?: string
  email?: string
  activeFlag: boolean
  billingProviderFlag: boolean
  renderingProviderFlag: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ProviderFormValues {
  _id?: string
  firstName: string
  lastName: string
  credentials: string
  specialty: string
  npi: string
  taxId: string
  taxonomyCode: string
  licenseNumber: string
  deaNumber: string
  providerType: string
  phone: string
  fax: string
  email: string
  activeFlag: boolean
  billingProviderFlag: boolean
  renderingProviderFlag: boolean
  active: boolean
}

export interface ProviderCreatePayload {
  firstName?: string
  lastName?: string
  credentials?: string
  specialty?: string
  npi?: string
  taxId?: string
  taxonomyCode?: string
  licenseNumber?: string
  deaNumber?: string
  providerType?: string
  phone?: string
  fax?: string
  email?: string
  activeFlag: boolean
  billingProviderFlag: boolean
  renderingProviderFlag: boolean
  active: boolean
}

export type ProviderUpdatePayload = ProviderCreatePayload
