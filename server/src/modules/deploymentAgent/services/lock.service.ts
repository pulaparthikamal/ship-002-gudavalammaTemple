// In-process deployment lock — prevents two deploys of the same application running simultaneously.
// For multi-instance deployments, replace with a Redis-backed distributed lock.

const activeLocks = new Map<string, string>();

export const lockService = {
  acquire(applicationId: string, deploymentId: string): boolean {
    const active = activeLocks.get(applicationId);
    if (active) {
      return active === deploymentId;
    }
    activeLocks.set(applicationId, deploymentId);
    return true;
  },

  release(applicationId: string, deploymentId: string): void {
    if (activeLocks.get(applicationId) === deploymentId) {
      activeLocks.delete(applicationId);
    }
  },

  isLocked(applicationId: string): boolean {
    return activeLocks.has(applicationId);
  },

  currentDeployment(applicationId: string): string | undefined {
    return activeLocks.get(applicationId);
  },
};
