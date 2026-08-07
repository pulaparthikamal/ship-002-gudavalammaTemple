import mongoose, { Schema, model, Model } from 'mongoose';
import { ObjectIdType } from '../../../types/common.types';

export interface IAi835Payload {
  _id?: ObjectIdType;
  claimId: ObjectIdType;
  claimSubmissionId: ObjectIdType;
  eraEobProcessingId?: ObjectIdType;
  fullPayment835: string;
  denialPayment835: string;
  denialCorrection835: string;
  generatedAt: Date;
  generatedBy?: ObjectIdType;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAi835PayloadModel extends Model<IAi835Payload> {}

const ai835PayloadSchema = new Schema<IAi835Payload, IAi835PayloadModel>(
  {
    claimId: {
      type: Schema.Types.ObjectId,
      ref: 'Claim',
      required: true,
      index: true,
    },
    claimSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ClaimSubmission',
      required: true,
      // index defined below via schema.index() with unique+sparse — do not add index:true here
    },
    eraEobProcessingId: {
      type: Schema.Types.ObjectId,
      ref: 'EraEobProcessing',
      index: true,
    },
    fullPayment835: { type: String, required: true },
    denialPayment835: { type: String, required: true },
    denialCorrection835: { type: String, required: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'ai835payloads',
  }
);

// One cached record per claimSubmissionId — upserted on regenerate
ai835PayloadSchema.index({ claimSubmissionId: 1 }, { unique: true, sparse: true });

export const Ai835Payload = model<IAi835Payload, IAi835PayloadModel>(
  'Ai835Payload',
  ai835PayloadSchema
);
