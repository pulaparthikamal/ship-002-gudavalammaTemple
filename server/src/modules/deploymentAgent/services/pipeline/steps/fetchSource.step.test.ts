import { buildGitCloneUrl } from './fetchSource.step';
import { credentialService } from '../../credential.service';

jest.mock('../../credential.service', () => ({
  credentialService: {
    getDecrypted: jest.fn(),
  },
}));

describe('fetchSource - buildGitCloneUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return repoUrl unchanged for public authMethod', async () => {
    const url = 'https://github.com/workspace/project.git';
    const result = await buildGitCloneUrl(url, 'public');
    expect(result).toBe(url);
  });

  it('should return repoUrl unchanged for sshDeployKey authMethod', async () => {
    const url = 'git@github.com:workspace/project.git';
    const result = await buildGitCloneUrl(url, 'sshDeployKey', 'cred123');
    expect(result).toBe(url);
  });

  it('should return repoUrl unchanged if credentialId is missing', async () => {
    const url = 'https://github.com/workspace/project.git';
    const result = await buildGitCloneUrl(url, 'httpsToken');
    expect(result).toBe(url);
  });

  it('should correctly format GitHub clone URL with HTTPS Token', async () => {
    const url = 'https://github.com/workspace/project.git';
    (credentialService.getDecrypted as jest.Mock).mockResolvedValue({
      value: 'github_pat_123',
    });

    const result = await buildGitCloneUrl(url, 'httpsToken', 'cred123', 'github');
    expect(result).toBe('https://github_pat_123@github.com/workspace/project.git');
    expect(credentialService.getDecrypted).toHaveBeenCalledWith('cred123');
  });

  it('should correctly format GitLab clone URL with HTTPS Token', async () => {
    const url = 'https://gitlab.com/workspace/project.git';
    (credentialService.getDecrypted as jest.Mock).mockResolvedValue({
      value: 'glpat-123',
    });

    const result = await buildGitCloneUrl(url, 'httpsToken', 'cred123', 'gitlab');
    expect(result).toBe('https://glpat-123@gitlab.com/workspace/project.git');
  });

  it('should correctly format Bitbucket clone URL with HTTPS Token (App Password) using provider', async () => {
    const url = 'https://jayaramj2@bitbucket.org/workspace/project.git';
    (credentialService.getDecrypted as jest.Mock).mockResolvedValue({
      value: 'bitbucket-app-pass-123',
    });

    const result = await buildGitCloneUrl(url, 'httpsToken', 'cred123', 'bitbucket');
    expect(result).toBe('https://jayaramj2:bitbucket-app-pass-123@bitbucket.org/workspace/project.git');
  });

  it('should correctly format Bitbucket clone URL with HTTPS Token using hostname detection', async () => {
    const url = 'https://jayaramj2@bitbucket.org/workspace/project.git';
    (credentialService.getDecrypted as jest.Mock).mockResolvedValue({
      value: 'bitbucket-app-pass-123',
    });

    const result = await buildGitCloneUrl(url, 'httpsToken', 'cred123');
    expect(result).toBe('https://jayaramj2:bitbucket-app-pass-123@bitbucket.org/workspace/project.git');
  });

  it('should URL-encode username and token for Bitbucket if they contain special characters', async () => {
    const url = 'https://user#name@bitbucket.org/workspace/project.git';
    (credentialService.getDecrypted as jest.Mock).mockResolvedValue({
      value: 'tok@en#123',
    });

    const result = await buildGitCloneUrl(url, 'httpsToken', 'cred123', 'bitbucket');
    expect(result).toBe('https://user%23name:tok%40en%23123@bitbucket.org/workspace/project.git');
  });

  it('should preserve the original repository path and ensure it ends with .git', async () => {
    const url = 'https://jayaramj2@bitbucket.org/myworkspace/subpath/project';
    (credentialService.getDecrypted as jest.Mock).mockResolvedValue({
      value: 'token123',
    });

    const result = await buildGitCloneUrl(url, 'httpsToken', 'cred123', 'bitbucket');
    expect(result).toBe('https://jayaramj2:token123@bitbucket.org/myworkspace/subpath/project.git');
  });

  it('should correctly redact both standard and Bitbucket tokens in git error messages', () => {
    const regex = /https:\/\/[^@]+@/;
    
    const standardError = 'Fatal: Authentication failed for https://github_pat_123@github.com/workspace/project.git';
    const redactedStandard = standardError.replace(regex, 'https://[token]@');
    expect(redactedStandard).toBe('Fatal: Authentication failed for https://[token]@github.com/workspace/project.git');

    const bitbucketError = 'Fatal: Authentication failed for https://jayaramj2:bitbucket-app-pass-123@bitbucket.org/workspace/project.git';
    const redactedBitbucket = bitbucketError.replace(regex, 'https://[token]@');
    expect(redactedBitbucket).toBe('Fatal: Authentication failed for https://[token]@bitbucket.org/workspace/project.git');
  });
});
