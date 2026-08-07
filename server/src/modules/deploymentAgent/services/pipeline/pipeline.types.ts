import { IApplication, IComponent } from '../../models/application.model';
import { IDeploymentTarget } from '../../models/deploymentTarget.model';
import { IDeployment } from '../../models/deployment.model';
import { SshClientConfig } from '../../utils/ssh.util';

export interface StepLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export interface PipelineContext {
  deployment: IDeployment;
  application: IApplication;
  target: IDeploymentTarget;
  component: IComponent;
  sshConfig: SshClientConfig;
  releaseTimestamp: number;
  releaseDir: string;
  componentReleaseDir: string;
  previousReleaseDir?: string;
  logger: StepLogger;
  aborted: boolean;
  pm2Path?: string;
}

export interface PipelineStep {
  name: string;
  shouldRun(ctx: PipelineContext): boolean;
  run(ctx: PipelineContext): Promise<void>;
}
