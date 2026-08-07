import { SshClientConfig, sshUtil } from '../utils/ssh.util';
import { deploymentPathUtil } from '../utils/path.util';

// Matches a full (40-char) or abbreviated (7-40 char) git commit SHA.
const GIT_SHA_RE = /^[a-f0-9]{7,40}$/i;

export const releaseService = {
  async listReleases(config: SshClientConfig, baseWebRoot: string, appName: string): Promise<string[]> {
    const releasesDir = deploymentPathUtil.releasesDir(baseWebRoot, appName);
    const result = await sshUtil.executeOnce(
      config,
      `ls -1t "${releasesDir}" 2>/dev/null || echo ""`,
      15000,
    );
    return result.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  },

  // In the simplified (no-symlink) folder structure, "activation" happens in-place via
  // fetchSource (git clone/reset). Nothing additional is needed here.
  async activateRelease(
    _config: SshClientConfig,
    _baseWebRoot: string,
    _appName: string,
    _componentKey: string,
    _releaseTimestamp: number,
    _isSingle = false,
  ): Promise<void> {
    // In-place deployment — activation is handled by fetchSource (git clone/reset).
  },

  // Roll back a component to a previous git commit SHA.
  // `previousReleasePath` is a git commit SHA captured before the last deployment by prepareDirectories.
  async rollbackRelease(
    config: SshClientConfig,
    baseWebRoot: string,
    appName: string,
    componentKey: string,
    previousReleasePath: string,
    isSingle = false,
  ): Promise<void> {
    const deployPath = deploymentPathUtil.componentDeployPath(baseWebRoot, appName, componentKey, isSingle);

    if (!previousReleasePath) {
      throw new Error('No previous release SHA available for rollback.');
    }

    if (!GIT_SHA_RE.test(previousReleasePath)) {
      throw new Error(
        `previousReleasePath "${previousReleasePath}" is not a valid git commit SHA. Cannot roll back.`,
      );
    }

    // Verify the git repo exists at the deploy path before attempting reset.
    const checkGit = await sshUtil.executeOnce(
      config,
      `[ -d "${deployPath}/.git" ] && echo ok || echo missing`,
      15000,
    );
    if (checkGit.stdout.trim() !== 'ok') {
      throw new Error(`No git repository found at "${deployPath}". Cannot perform git-based rollback.`);
    }

    // Reset the working tree to the previous commit SHA.
    const resetResult = await sshUtil.executeOnce(
      config,
      `cd "${deployPath}" && git reset --hard "${previousReleasePath}" && git clean -fd`,
      120000,
    );
    if (resetResult.code !== 0) {
      throw new Error(`git reset --hard failed: ${resetResult.stderr || resetResult.stdout}`);
    }
  },

  // The simplified structure does not maintain separate release directories,
  // so pruning is a no-op. Disk space is managed by git's own history.
  async pruneOldReleases(
    _config: SshClientConfig,
    _baseWebRoot: string,
    _appName: string,
    _keepCount: number,
  ): Promise<void> {
    // No release directories to prune in the simplified (in-place) structure.
  },

  async getCurrentReleaseTarget(
    config: SshClientConfig,
    baseWebRoot: string,
    appName: string,
    componentKey: string,
    isSingle = false,
  ): Promise<string | undefined> {
    const deployPath = deploymentPathUtil.componentDeployPath(baseWebRoot, appName, componentKey, isSingle);
    const result = await sshUtil.executeOnce(
      config,
      `[ -d "${deployPath}/.git" ] && cd "${deployPath}" && git rev-parse HEAD || echo ""`,
      15000,
    );
    const sha = result.stdout.trim();
    return sha || undefined;
  },
};
