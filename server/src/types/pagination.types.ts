export interface FilterCriteria {
  key: string;
  value: any;
  type: string;
}

export interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  order?: 'asc' | 'desc' | '1' | '-1';
  search?: string;
  filter?: string; // JSON string containing FilterPayload
}

export interface FilterPayload {
  limit?: number;
  page?: number;
  sortfield?: string;
  direction?: 'asc' | 'desc';
  criteria?: FilterCriteria[];
  search?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
