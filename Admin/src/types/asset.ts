export type AssetCategory = 'furniture' | 'electronics' | 'vehicle' | 'jewellery' | 'other'

export interface Asset {
  _id: string
  name: string
  category?: AssetCategory | string
  purchaseDate?: string
  cost: number
  currentValue: number
  custodian?: string
  location?: string
  active: boolean
  created: string
  updated: string
}

export interface AssetFormValues {
  _id?: string
  name: string
  category: AssetCategory | ''
  purchaseDate: Date | string | null
  cost: number
  currentValue: number
  custodian: string
  location: string
  active: boolean
}

export interface AssetCreatePayload {
  name: string
  category?: AssetCategory
  purchaseDate?: string
  cost: number
  currentValue: number
  custodian?: string
  location?: string
  active: boolean
}

export type AssetUpdatePayload = AssetCreatePayload
