import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { AppError } from '../../../utils/error.util';

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function assertUnsafeMutationAllowed(entityName: string, action = 'mutated') {
  throw new AppError(
    `${entityName} records are append-only in production and controlled-pilot workflows and cannot be ${action}. Use controlled workflow actions instead.`,
    HTTP_STATUS.BAD_REQUEST
  );
}

export function rejectAppendOnlyMutation(entityName: string, action = 'mutated') {
  throw new AppError(
    `${entityName} records are append-only in production and controlled-pilot workflows and cannot be ${action}. Use controlled workflow actions instead.`,
    HTTP_STATUS.BAD_REQUEST
  );
}

export function requireActionReason(reason: unknown, label: string) {
  const normalized = typeof reason === 'string' ? reason.trim() : '';
  if (!normalized) {
    throw new AppError(`${label} reason is required.`, HTTP_STATUS.BAD_REQUEST);
  }
  return normalized;
}
