export interface Rule {
  _id: string;
  ruleId: string;
  type: string;
  message: string;
  severity: string;
  payerId?: string;
  providerId?: string;
  facilityId?: string;
  state?: string;
  placeOfServiceCode?: string;
  planName?: string;
  groupNumber?: string;
  network?: string;
  coverageType?: string;
  codes?: string[];
  code?: string;
  limit?: string;
  requiredFields?: string[];
  effectiveDate?: string;
  expiryDate?: string;
  active: boolean;
  isDeleted: boolean;
  created: string;
  updated: string;
}

export interface RuleFormValues {
  ruleId: string;
  type: string;
  message: string;
  severity: string;
  payerId?: string;
  providerId?: string;
  facilityId?: string;
  state?: string;
  placeOfServiceCode?: string;
  planName?: string;
  groupNumber?: string;
  network?: string;
  coverageType?: string;
  codes?: string[];
  code?: string;
  limit?: string;
  requiredFields?: string[];
  effectiveDate?: string | Date;
  expiryDate?: string | Date;
  active: boolean;
}

export interface RuleCreatePayload extends RuleFormValues {}
export interface RuleUpdatePayload extends Partial<RuleFormValues> {}
