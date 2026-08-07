import { PaginationMeta } from './pagination.types';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  respMessage: string;
  data: T | null;
  meta: PaginationMeta | null;
  errors: any[] | null;
  accessToken?: string;
  refreshToken?: string;
}
