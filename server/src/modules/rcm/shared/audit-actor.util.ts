import { Types } from 'mongoose';

export function normalizeObjectIdAuditActor(actor: unknown) {
  if (actor instanceof Types.ObjectId) {
    return actor;
  }

  const value = typeof actor === 'string' ? actor.trim() : '';
  return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
}

export function auditActorPatch(field: 'createdBy' | 'updatedBy', actor: unknown) {
  const objectId = normalizeObjectIdAuditActor(actor);
  return objectId ? { [field]: objectId } : {};
}

export function assignAuditActor(target: Record<string, any>, field: 'createdBy' | 'updatedBy', actor: unknown) {
  const objectId = normalizeObjectIdAuditActor(actor);
  if (objectId) {
    target[field] = objectId;
  }
}

export function omitAuditActorFields<T extends Record<string, any>>(data: T | undefined | null) {
  const source = (data ?? {}) as Record<string, any>;
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...rest } = source;
  return rest as Omit<T, 'createdBy' | 'updatedBy'>;
}
