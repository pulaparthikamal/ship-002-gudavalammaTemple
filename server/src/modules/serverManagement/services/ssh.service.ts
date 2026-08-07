import { Client, ConnectConfig } from 'ssh2';
import { IServerConnection } from '../models/serverConnection.model';
import { secretCrypto } from '../utils/crypto.util';
import { logger } from '../../../utils/logger.util';

export interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

type SshPhase = 'connect' | 'command';

const maxConnectRetries = Math.max(
  1,
  Math.min(Number(process.env.SSH_CONNECT_RETRIES) || 3, 5),
);
const connectRetryDelayMs = Math.max(
  100,
  Math.min(Number(process.env.SSH_CONNECT_RETRY_DELAY_MS) || 500, 5000),
);
const sshCommandGapMs = Math.max(
  0,
  Math.min(Number(process.env.SSH_COMMAND_GAP_MS) || 250, 5000),
);

const queueByServer = new Map<string, Promise<unknown>>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getServerQueueKey = (server: IServerConnection) =>
  `${String(server._id || server.host)}:${server.host}:${server.port}:${server.username}`;

const runQueued = async <T>(server: IServerConnection, task: () => Promise<T>): Promise<T> => {
  const key = getServerQueueKey(server);
  const previous = queueByServer.get(key) || Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  queueByServer.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    if (sshCommandGapMs > 0) {
      await wait(sshCommandGapMs);
    }
    release();
    if (queueByServer.get(key) === tail) {
      queueByServer.delete(key);
    }
  }
};

const markSshPhase = (error: Error, phase: SshPhase) => {
  (error as Error & { sshPhase?: SshPhase }).sshPhase = phase;
  return error;
};

const getErrorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

const isTransientConnectError = (error: unknown) => {
  const sshPhase = (error as { sshPhase?: SshPhase })?.sshPhase;
  if (sshPhase !== 'connect') {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);

  return (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE' ||
    /connection lost before handshake|read ECONNRESET|handshake|timed out/i.test(message)
  );
};

const buildSshConfig = (server: IServerConnection): ConnectConfig => {
  const config: ConnectConfig = {
    host: server.host,
    port: server.port,
    username: server.username,
    readyTimeout: 15000,
  };

  if (server.authType === 'password') {
    config.password = secretCrypto.decrypt(server.encryptedPassword);
  } else {
    config.privateKey = secretCrypto.decrypt(server.encryptedPrivateKey);
    config.passphrase = secretCrypto.decrypt(server.encryptedPassphrase);
  }

  return config;
};

export const sshService = {
  executeOnce(
    server: IServerConnection,
    command: string,
    timeoutMs = 30000,
  ): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let settled = false;
      let connected = false;
      let timer: NodeJS.Timeout | undefined;

      const finish = (fn: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        conn.end();
        fn();
      };

      timer = setTimeout(() => {
        finish(() =>
          reject(
            markSshPhase(
              new Error(`SSH command timed out after ${timeoutMs}ms`),
              connected ? 'command' : 'connect',
            ),
          ),
        );
      }, timeoutMs);

      conn
        .on('ready', () => {
          connected = true;
          conn.exec(command, (error, stream) => {
            if (error) {
              finish(() => reject(markSshPhase(error, 'command')));
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
        .on('error', (error) => {
          finish(() => reject(markSshPhase(error, connected ? 'command' : 'connect')));
        })
        .connect(buildSshConfig(server));
    });
  },

  async executeWithRetries(
    server: IServerConnection,
    command: string,
    timeoutMs = 30000,
  ): Promise<SshCommandResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxConnectRetries; attempt += 1) {
      try {
        return await this.executeOnce(server, command, timeoutMs);
      } catch (error) {
        lastError = error;
        if (!isTransientConnectError(error) || attempt >= maxConnectRetries) {
          throw error;
        }

        const delay = connectRetryDelayMs * attempt;
        // logger.debug(
        //   `SSH connection attempt ${attempt}/${maxConnectRetries} failed for ${server.host}:${server.port}; retrying in ${delay}ms: ${
        //     error instanceof Error ? error.message : String(error)
        //   }`,
        // );
        await wait(delay);
      }
    }

    throw lastError;
  },

  async execute(
    server: IServerConnection,
    command: string,
    timeoutMs = 30000,
  ): Promise<SshCommandResult> {
    return runQueued(server, () => this.executeWithRetries(server, command, timeoutMs));
  },

  async executeNoRetry(
    server: IServerConnection,
    command: string,
    timeoutMs = 30000,
  ): Promise<SshCommandResult> {
    return runQueued(server, () => this.executeOnce(server, command, timeoutMs));
  },

  async test(server: IServerConnection) {
    const result = await this.execute(server, 'hostname && uptime', 15000);
    return {
      reachable: result.code === 0,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  },
};
