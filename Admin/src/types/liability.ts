export type LiabilityStatus = 'open' | 'paid'

export interface Liability {
  _id: string
  name: string
  category?: string
  amount: number
  dueDate?: string
  creditor?: string
  status: LiabilityStatus
  notes?: string
  active: boolean
  created: string
  updated: string
}

export interface LiabilityFormValues {
  _id?: string
  name: string
  category: string
  amount: number
  dueDate: Date | string | null
  creditor: string
  status: LiabilityStatus
  notes: string
  active: boolean
}

export interface LiabilityCreatePayload {
  name: string
  category?: string
  amount: number
  dueDate?: string
  creditor?: string
  status: LiabilityStatus
  notes?: string
  active: boolean
}

export type LiabilityUpdatePayload = LiabilityCreatePayload
