import { Client, ConnectConfig } from 'ssh2';

export interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface SshClientConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  passphrase?: string;
  password?: string;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const buildConnectConfig = (config: SshClientConfig): ConnectConfig => {
  const base: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: 20000,
  };

  if (config.privateKey) {
    base.privateKey = config.privateKey;
    base.passphrase = config.passphrase;
  } else {
    base.password = config.password;
  }

  return base;
};

/**
 * Build a sudo-prefixed command that works over non-interactive SSH.
 * When a password is available (password auth), pipes it via stdin using `sudo -S`.
 * When no password (SSH-key auth), falls back to bare `sudo` (assumes NOPASSWD sudoers).
 */
export function buildSudo(
  privilegeEscalation: 'sudo' | 'none',
  password: string | undefined,
  cmd: string,
): string {
  if (privilegeEscalation !== 'sudo') return cmd;
  if (password) {
    const safe = password.replace(/'/g, `'\\''`); // escape single quotes
    return `echo '${safe}' | sudo -S -p '' ${cmd}`;
  }
  return `sudo ${cmd}`;
}

export const sshUtil = {
  executeOnce(
    config: SshClientConfig,
    command: string,
    timeoutMs = 60000,
  ): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let settled = false;
      let connected = false;
      let timer: NodeJS.Timeout | undefined;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        conn.end();
        fn();
      };

      timer = setTimeout(() => {
        finish(() => reject(new Error(`SSH command timed out after ${timeoutMs}ms: ${command.slice(0, 80)}`)));
      }, timeoutMs);

      conn
        .on('ready', () => {
          connected = true;
          conn.exec(command, (err, stream) => {
            if (err) {
              finish(() => reject(err));
              return;
            }

            let stdout = '';
            let stderr = '';

            stream
              .on('close', (code: number | null) => {
                finish(() => resolve({ stdout, stderr, code }));
              })
              .on('data', (data: Buffer) => {
                stdout += data.toString();
              });

            stream.stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });
          });
        })
        .on('error', (err) => {
          finish(() => reject(err));
        })
        .connect(buildConnectConfig(config));
    });
  },

  async executeWithRetry(
    config: SshClientConfig,
    command: string,
    timeoutMs = 60000,
    maxRetries = 3,
  ): Promise<SshCommandResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeOnce(config, command, timeoutMs);
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const isTransient = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|handshake/i.test(message);
        if (!isTransient || attempt >= maxRetries) throw err;
        await wait(500 * attempt);
      }
    }
    throw lastError;
  },

  async writeFile(
    config: SshClientConfig,
    remotePath: string,
    content: string,
    timeoutMs = 30000,
  ): Promise<void> {
    const escaped = content.replace(/'/g, `'\\''`);
    const command = `mkdir -p "$(dirname '${remotePath}')" && printf '%s' '${escaped}' > '${remotePath}'`;
    const result = await this.executeOnce(config, command, timeoutMs);
    if (result.code !== 0) {
      throw new Error(`Failed to write file ${remotePath}: ${result.stderr}`);
    }
  },
};
