import { Document, Types } from 'mongoose';

export type ObjectIdType = Types.ObjectId | string;

export interface BaseDocument extends Document {
  created?: Date;
  updated?: Date;
}

export interface AttachmentLink {
  documentType?: string;
  title?: string;
  fileUrl?: string;
  description?: string;
}
