import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import { ICommitInfo } from './deployment.model';

export type PredictionRecommendation = 'proceed' | 'proceed_with_caution' | 'block';
export type PredictionSource = 'ai' | 'heuristic' | 'no_changes' | 'unavailable';
export type PredictionRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ICommitEntry {
  sha: string;
  message?: string;
  author?: string;
  date?: string;
}

export interface IChangedFile {
  path: string;
  changeType: string; // A | M | D | R | ... (git --name-status), or 'unknown'
  additions?: number;
  deletions?: number;
  diff?: string;
}

export interface IPredictionRisk {
  severity: PredictionRiskSeverity;
  area: string; // commit | dependencies | config | database | infrastructure
  issue: string;
  mitigation?: string;
}

export interface IImpactedComponent {
  key: string;
  type?: string;
  reason?: string;
  downstream?: boolean;
}

export interface IDependencyNode {
  key: string;
  type: string;
  port?: number;
}

export interface IDependencyEdge {
  from: string;
  to: string;
  relation: string;
}

export interface IDeploymentPrediction extends BaseDocument {
  applicationId: Types.ObjectId;
  targetId: Types.ObjectId;
  deploymentId?: Types.ObjectId; // mapped once the deployment is actually triggered
  branch?: string;
  commit?: ICommitInfo;
  commits: ICommitEntry[]; // ordered list of incoming commits (HEAD..origin/branch)
  changedFiles: IChangedFile[];

  // Core intelligence metrics
  riskScore: number; // 0-100
  failureProbability: number; // 0-100
  confidenceScore: number; // 0-100
  recommendation: PredictionRecommendation;

  // LLM-generated content
  summary?: string;
  risks: IPredictionRisk[];
  impactedComponents: IImpactedComponent[];
  recommendations: string[];

  // Infrastructure impact graph
  dependencyGraph?: {
    nodes: IDependencyNode[];
    edges: IDependencyEdge[];
  };

  source: PredictionSource;
  noChangesDetected?: boolean; // true when no new commits or changed files were found
  predictionUnavailable?: boolean; // true when the LLM prediction could not be generated but the auto-deploy proceeded
  predictionError?: string; // honest reason the prediction could not be generated (no synthetic scores)
  llmProvider?: string;
  llmModel?: string;
  proceeded?: boolean; // did the user go ahead and deploy from this prediction?

  triggeredBy?: Types.ObjectId;
  active: boolean;
  created: Date;
  updated: Date;
}

const commitEntrySchema = new Schema<ICommitEntry>(
  {
    sha: { type: String, required: true },
    message: { type: String },
    author: { type: String },
    date: { type: String },
  },
  { _id: false },
);

const changedFileSchema = new Schema<IChangedFile>(
  {
    path: { type: String, required: true },
    changeType: { type: String, default: 'unknown' },
    additions: { type: Number },
    deletions: { type: Number },
    diff: { type: String },
  },
  { _id: false },
);

const riskSchema = new Schema<IPredictionRisk>(
  {
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    area: { type: String, default: 'commit' },
    issue: { type: String, required: true },
    mitigation: { type: String },
  },
  { _id: false },
);

const impactedComponentSchema = new Schema<IImpactedComponent>(
  {
    key: { type: String, required: true },
    type: { type: String },
    reason: { type: String },
    downstream: { type: Boolean, default: false },
  },
  { _id: false },
);

const dependencyNodeSchema = new Schema<IDependencyNode>(
  {
    key: { type: String, required: true },
    type: { type: String, required: true },
    port: { type: Number },
  },
  { _id: false },
);

const dependencyEdgeSchema = new Schema<IDependencyEdge>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    relation: { type: String, required: true },
  },
  { _id: false },
);

const deploymentPredictionSchema = new Schema<IDeploymentPrediction>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'DeploymentTarget', required: true, index: true },
    deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', index: true },
    branch: { type: String, trim: true },
    commit: {
      type: new Schema<ICommitInfo>(
        {
          sha: { type: String, trim: true },
          message: { type: String, trim: true },
          author: { type: String, trim: true },
          ref: { type: String, trim: true },
        },
        { _id: false },
      ),
    },
    commits: { type: [commitEntrySchema], default: [] },
    changedFiles: { type: [changedFileSchema], default: [] },

    riskScore: { type: Number, required: true, min: 0, max: 100 },
    failureProbability: { type: Number, required: true, min: 0, max: 100 },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    recommendation: {
      type: String,
      enum: ['proceed', 'proceed_with_caution', 'block'],
      default: 'proceed',
    },

    summary: { type: String },
    risks: { type: [riskSchema], default: [] },
    impactedComponents: { type: [impactedComponentSchema], default: [] },
    recommendations: { type: [String], default: [] },

    dependencyGraph: {
      type: new Schema(
        {
          nodes: { type: [dependencyNodeSchema], default: [] },
          edges: { type: [dependencyEdgeSchema], default: [] },
        },
        { _id: false },
      ),
    },

    source: { type: String, enum: ['ai', 'heuristic', 'no_changes', 'unavailable'], default: 'ai', index: true },
    noChangesDetected: { type: Boolean, default: false },
    predictionUnavailable: { type: Boolean, default: false },
    predictionError: { type: String },
    llmProvider: { type: String },
    llmModel: { type: String },
    proceeded: { type: Boolean, default: false },

    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deployment_predictions',
  },
);

deploymentPredictionSchema.index({ applicationId: 1, created: -1 });
deploymentPredictionSchema.index({ deploymentId: 1 });
deploymentPredictionSchema.index({ created: -1 });

export const DeploymentPrediction = model<IDeploymentPrediction>(
  'DeploymentPrediction',
  deploymentPredictionSchema,
);
