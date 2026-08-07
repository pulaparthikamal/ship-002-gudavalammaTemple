import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IServerProject extends BaseDocument {
  server: Types.ObjectId;
  projectName: string;
  portNumber: string;
  projectPath: string;
  dbUser: string;
  databaseName: string;
  dbType: string;
  dbHost: string;
  dbPort: string;
  configFile: string;
  discoveryStatus: string;
  nginxFile: string;
  active: boolean;
  created: Date;
  updated: Date;
}

const serverProjectSchema = new Schema<IServerProject>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    projectName: { type: String, required: true, trim: true },
    portNumber: { type: String, default: '', trim: true },
    projectPath: { type: String, default: '', trim: true },
    dbUser: { type: String, default: '', trim: true },
    databaseName: { type: String, default: '', trim: true },
    dbType: { type: String, default: '', trim: true },
    dbHost: { type: String, default: '', trim: true },
    dbPort: { type: String, default: '', trim: true },
    configFile: { type: String, default: '', trim: true },
    discoveryStatus: { type: String, default: '', trim: true },
    nginxFile: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    // Dedicated collection: the shared dev DB already has a `server_projects` collection
    // owned by the deployment module (Docker container projects), so we must not collide.
    collection: 'server_discovered_projects',
  }
);

serverProjectSchema.index({ server: 1, projectName: 1 }, { unique: true });

export const ServerProject = model<IServerProject>('ServerProject', serverProjectSchema);
