import { Schema } from 'mongoose';
import { ObjectIdType } from '../../../types/common.types';

export interface IStatusHistoryEntry {
  status: string;
  changedAt: Date;
  changedBy?: ObjectIdType;
  note?: string;
}

export const statusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    status: { type: String, trim: true, required: true },
    changedAt: { type: Date, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
  },
  { _id: false }
);

export function appendStatusHistory(
  history: IStatusHistoryEntry[] | undefined,
  status: string | undefined,
  changedBy?: ObjectIdType | string,
  note?: string
) {
  const normalizedStatus = status?.trim();

  if (!normalizedStatus) {
    return history ?? [];
  }

  const nextHistory = [...(history ?? [])];
  const lastEntry = nextHistory[nextHistory.length - 1];

  if (lastEntry?.status === normalizedStatus) {
    return nextHistory;
  }

  nextHistory.push({
    status: normalizedStatus,
    changedAt: new Date(),
    changedBy: changedBy as ObjectIdType | undefined,
    note: note?.trim() || undefined,
  });

  return nextHistory;
}
