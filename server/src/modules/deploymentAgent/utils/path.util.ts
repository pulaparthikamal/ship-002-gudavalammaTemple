export const deploymentPathUtil = {
  releasesDir(baseWebRoot: string, appName: string): string {
    return `${baseWebRoot}/${appName}`;
  },

  releaseDir(baseWebRoot: string, appName: string, timestamp: number): string {
    return `${baseWebRoot}/${appName}`;
  },

  currentSymlink(baseWebRoot: string, appName: string): string {
    return `${baseWebRoot}/${appName}`;
  },

  componentDeployPath(baseWebRoot: string, appName: string, componentKey: string, isSingle = false): string {
    return isSingle ? `${baseWebRoot}/${appName}` : `${baseWebRoot}/${appName}/${componentKey}`;
  },

  componentReleasePath(releaseDir: string, componentKey: string, isSingle = false): string {
    return isSingle ? releaseDir : `${releaseDir}/${componentKey}`;
  },

  componentCurrentSymlink(baseWebRoot: string, appName: string, componentKey: string, isSingle = false): string {
    return this.componentDeployPath(baseWebRoot, appName, componentKey, isSingle);
  },

  sanitize(path: string): string {
    if (!path.startsWith('/')) {
      throw new Error(`Path must be absolute: ${path}`);
    }
    if (path.includes('..')) {
      throw new Error(`Path traversal not allowed: ${path}`);
    }
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  },

  pm2AppName(appName: string, componentKey: string): string {
    return `${appName}-${componentKey}`;
  },

  resolveWorkDir(baseDir: string, applicationPath?: string, sourcePath?: string): string {
    let dir = baseDir;
    const appPath = applicationPath?.trim().replace(/^\.\//, '');
    const compPath = sourcePath?.trim().replace(/^\.\//, '');
    if (appPath) dir = `${dir}/${appPath}`;
    if (compPath) dir = `${dir}/${compPath}`;
    return dir;
  },
};
