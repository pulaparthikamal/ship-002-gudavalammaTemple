export interface ProcedureCode {
  _id: string;
  procedureCodeId: string;
  code: string;
  description: string;
  chargeFee: number;
  category: string;
  requiresAuth: boolean;
  frequencyLimit?: string;
  active: boolean;
  isDeleted: boolean;
  created: string;
  updated: string;
}

export interface ProcedureCodeFormValues {
  code: string;
  description: string;
  chargeFee: number;
  category: string;
  requiresAuth: boolean;
  frequencyLimit?: string;
  active: boolean;
}

export interface ProcedureCodeCreatePayload extends ProcedureCodeFormValues {}
export interface ProcedureCodeUpdatePayload extends Partial<ProcedureCodeFormValues> {}
