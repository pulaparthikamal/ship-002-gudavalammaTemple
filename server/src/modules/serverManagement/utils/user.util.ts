import { Request } from 'express';
import { Types } from 'mongoose';

export const getRequestUserId = (req: Request): Types.ObjectId | undefined => {
  const user = req.user as { _id?: Types.ObjectId | string; id?: Types.ObjectId | string } | undefined;
  const id = user?._id || user?.id;

  if (!id) {
    return undefined;
  }

  return new Types.ObjectId(String(id));
};
