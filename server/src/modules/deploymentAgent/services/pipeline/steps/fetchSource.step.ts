import { PipelineStep, PipelineContext } from '../pipeline.types';
import { sshUtil } from '../../../utils/ssh.util';
import { credentialService } from '../../credential.service';

export const buildGitCloneUrl = async (
  repoUrl: string,
  authMethod: string,
  credentialId?: string,
  provider?: string,
): Promise<string> => {
  if (authMethod === 'public' || !credentialId) return repoUrl;
  if (authMethod === 'httpsToken') {
    const cred = await credentialService.getDecrypted(credentialId);
    const token = cred.value || '';

    let isBitbucket = provider === 'bitbucket';
    if (!isBitbucket) {
      const lowerUrl = repoUrl.toLowerCase();
      if (lowerUrl.includes('bitbucket.org/') || lowerUrl.includes('.bitbucket.org/')) {
        isBitbucket = true;
      }
    }

    if (isBitbucket) {
      try {
        const match = repoUrl.match(/^https:\/\/(?:([^@]+)@)?([^/]+)\/(.+)$/);
        if (match) {
          const rawUsername = match[1] || '';
          const hostname = match[2] || '';
          const restPath = match[3] || '';

          const pathParts = restPath.split('/').filter(Boolean);
          const workspace = pathParts[0] || '';
          let repository = pathParts.slice(1).join('/');
          if (repository.endsWith('.git')) {
            repository = repository.slice(0, -4);
          }

          let decodedUsername = rawUsername;
          try {
            decodedUsername = decodeURIComponent(rawUsername);
          } catch (e) {
            // Fallback to rawUsername if decoding fails
          }

          const encodedUsername = encodeURIComponent(decodedUsername);
          const encodedToken = encodeURIComponent(token);
          return `https://${encodedUsername}:${encodedToken}@${hostname}/${workspace}/${repository}.git`;
        }
      } catch (e) {
        // Fallback on parsing failure
      }
    }

    return repoUrl.replace('https://', `https://${token}@`);
  }
  // SSH deploy key — handled via ssh agent or key injection; return url as-is
  return repoUrl;
};

export const fetchSourceStep: PipelineStep = {
  name: 'fetch-source',

  shouldRun(_ctx: PipelineContext): boolean {
    return true;
  },

  async run(ctx: PipelineContext): Promise<void> {
    const { application, component, sshConfig } = ctx;
    const layout = application.layout;

    // Resolve which repo URL to use for this component
    const repoUrl =
      layout === 'multi-repo' && component.repoUrl
        ? component.repoUrl
        : application.repository.url;

    // Prefer the branch recorded on the deployment (set from webhook push ref or manual trigger);
    // fall back to the application's default repository branch.
    const branch = ctx.deployment.branch || application.repository.branch || 'main';
    const authMethod = application.repository.authMethod;
    const credentialId = application.repository.credentialId
      ? String(application.repository.credentialId)
      : undefined;
    const provider = application.repository.provider;

    const cloneUrl = await buildGitCloneUrl(repoUrl, authMethod, credentialId, provider);
    const targetDir = ctx.componentReleaseDir;

    const checkGitCmd = `[ -d "${targetDir}/.git" ] && echo exists || echo missing`;
    const gitCheck = await sshUtil.executeOnce(sshConfig, checkGitCmd, 15000);
    const gitExists = gitCheck.stdout.trim() === 'exists';

    let runCmd = '';
    if (gitExists) {
      ctx.logger.info(`Existing repository found. Fetching latest changes and resetting to origin/${branch}…`);
      runCmd = [
        `cd "${targetDir}"`,
        `git remote set-url origin "${cloneUrl}"`,
        `git fetch origin "${branch}"`,
        `git reset --hard "origin/${branch}"`,
        `git clean -fd`,
      ].join(' && ');
    } else {
      ctx.logger.info(`Cleaning target directory and cloning ${repoUrl} (branch: ${branch})…`);
      runCmd = `rm -rf "${targetDir}" && git clone --depth 1 --branch "${branch}" "${cloneUrl}" "${targetDir}"`;
    }

    const result = await sshUtil.executeOnce(sshConfig, runCmd, 180000);


    if (result.code !== 0) {
      // Redact token from error before logging
      const safeErr = result.stderr.replace(/https:\/\/[^@]+@/, 'https://[token]@');
      throw new Error(`Git clone/fetch/reset failed: ${safeErr}`);
    }

    // Verify applicationPath exists when set
    const applicationPath = (application as any).applicationPath?.trim().replace(/^\.\//, '');
    if (applicationPath) {
      const appDir = `${targetDir}/${applicationPath}`;
      const check = await sshUtil.executeOnce(sshConfig, `test -d "${appDir}" && echo ok`, 10000);
      if (check.stdout.trim() !== 'ok') {
        throw new Error(`applicationPath "${applicationPath}" not found in cloned repository.`);
      }
      ctx.logger.info(`Using application path: ${applicationPath}`);
    }

    // For monorepos, verify the component sourcePath exists (resolved within applicationPath if set)
    if (layout === 'monorepo' && component.sourcePath) {
      const basePath = applicationPath ? `${targetDir}/${applicationPath}` : targetDir;
      const checkPath = `${basePath}/${component.sourcePath.replace(/^\.\//, '')}`;
      const check = await sshUtil.executeOnce(sshConfig, `test -d "${checkPath}" && echo ok`, 10000);
      if (check.stdout.trim() !== 'ok') {
        throw new Error(`Monorepo sourcePath "${component.sourcePath}" not found in cloned repository.`);
      }
      ctx.logger.info(`Monorepo: using source path ${component.sourcePath}`);
    }

    ctx.logger.info('Source fetched successfully.');
  },
};
