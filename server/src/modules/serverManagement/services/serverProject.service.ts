import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Types } from 'mongoose';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { AppError } from '../../../utils/error.util';
import { logger } from '../../../utils/logger.util';
import { secretCrypto } from '../utils/crypto.util';
import { IServerConnection, ServerConnection } from '../models/serverConnection.model';
import { ServerProject } from '../models/serverProject.model';

const execFileAsync = promisify(execFile);

// Aligned with the 10-minute envelope used by the frontend (LONG_RUNNING_API_TIMEOUT_MS)
// and the Node HTTP server (server.setTimeout). The discovery script walks /var/www across
// every nginx site, so it needs the full window to return data on busy servers.
const DISCOVERY_TIMEOUT_MS = Math.max(
  60000,
  Number(process.env.SERVER_PROJECT_DISCOVERY_TIMEOUT_MS) || 600000,
);
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

// The .sh file ships in src/scripts and is not copied into dist by tsc, so we resolve it
// from a few well-known locations relative to the build and the working directory.
const SCRIPT_CANDIDATES = [
  path.resolve(__dirname, '../../../scripts/remote-project-discovery.sh'),
  path.resolve(process.cwd(), 'src/scripts/remote-project-discovery.sh'),
  path.resolve(process.cwd(), 'dist/scripts/remote-project-discovery.sh'),
];

const resolveScriptPath = () => {
  const scriptPath = SCRIPT_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!scriptPath) {
    throw new AppError('Project discovery script not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  return scriptPath;
};

// Minimal CSV line parser that understands the double-quote quoting emitted by Python's csv module.
const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

export interface DiscoveredProject {
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
}

const extractCsvSection = (stdout: string, title: string) => {
  const lines = stdout.split('\n');
  const titleIndex = lines.findIndex((line) => line.includes(`================ ${title} ================`));
  if (titleIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (const line of lines.slice(titleIndex + 1)) {
    if (line.includes('================ ') && line.includes(' ================')) {
      break;
    }
    const trimmed = line.trim();
    if (trimmed) {
      sectionLines.push(trimmed);
    }
  }
  return sectionLines;
};

const parseDiscoveryOutput = (stdout: string): DiscoveredProject[] => {
  const section = extractCsvSection(stdout, 'DOMAIN + PROJECT + DB REPORT');
  const lines = section.length ? section : stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const domainIndex = headers.indexOf('Domain');
  const portIndex = headers.indexOf('Port');
  const projectPathIndex = headers.indexOf('Project_Path');
  const dbUserIndex = headers.indexOf('DB_User');
  const dbNameIndex = headers.indexOf('DB_Name');
  const dbTypeIndex = headers.indexOf('DB_Type');
  const dbHostIndex = headers.indexOf('DB_Host');
  const dbPortIndex = headers.indexOf('DB_Port');
  const configFileIndex = headers.indexOf('Config_File');
  const statusIndex = headers.indexOf('Status');
  const nginxFileIndex = headers.indexOf('Nginx_File');
  if (domainIndex === -1) {
    return [];
  }

  const seen = new Set<string>();
  const projects: DiscoveredProject[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const projectName = (cells[domainIndex] || '').trim();
    if (!projectName || seen.has(projectName)) {
      continue;
    }

    seen.add(projectName);
    projects.push({
      projectName,
      portNumber: (cells[portIndex] || '').trim(),
      projectPath: (cells[projectPathIndex] || '').trim(),
      dbUser: (cells[dbUserIndex] || '').trim(),
      databaseName: (cells[dbNameIndex] || '').trim(),
      dbType: (cells[dbTypeIndex] || '').trim(),
      dbHost: (cells[dbHostIndex] || '').trim(),
      dbPort: (cells[dbPortIndex] || '').trim(),
      configFile: (cells[configFileIndex] || '').trim(),
      discoveryStatus: (cells[statusIndex] || '').trim(),
      nginxFile: (cells[nginxFileIndex] || '').trim(),
    });
  }

  return projects;
};

interface ScriptRunContext {
  env: NodeJS.ProcessEnv;
  cleanup: () => void;
}

// SSH_ASKPASS lets the unmodified `ssh` call in the script read a password/passphrase
// non-interactively from a helper script, without needing sshpass installed.
const configureAskpass = (
  tmpDir: string,
  env: NodeJS.ProcessEnv,
  secret: string,
) => {
  const secretFile = path.join(tmpDir, 'askpass-secret');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });

  const askpassFile = path.join(tmpDir, 'askpass.sh');
  fs.writeFileSync(askpassFile, `#!/bin/sh\ncat ${JSON.stringify(secretFile)}\n`, { mode: 0o700 });

  env.SSH_ASKPASS = askpassFile;
  env.SSH_ASKPASS_REQUIRE = 'force';
  env.DISPLAY = env.DISPLAY || ':0';
};

// Builds an isolated HOME/.ssh so the script's `ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST`
// authenticates with the credentials stored for this server, then runs the .sh as written.
const prepareScriptRun = (server: IServerConnection): ScriptRunContext => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-discovery-'));
  const sshDir = path.join(tmpDir, '.ssh');
  fs.mkdirSync(sshDir, { mode: 0o700 });

  const configLines = [
    'Host *',
    '    StrictHostKeyChecking no',
    '    UserKnownHostsFile /dev/null',
    '    LogLevel ERROR',
  ];

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: tmpDir,
    SERVER_HOST: server.host,
    SERVER_USER: server.username,
    SERVER_PORT: String(server.port || 22),
  };

  if (server.authType === 'sshKey') {
    const privateKey = secretCrypto.decrypt(server.encryptedPrivateKey);
    if (!privateKey) {
      throw new AppError('Server private key is missing or could not be decrypted.', HTTP_STATUS.BAD_REQUEST);
    }

    const keyFile = path.join(sshDir, 'id_discovery');
    fs.writeFileSync(keyFile, privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`, { mode: 0o600 });
    configLines.push('    IdentitiesOnly yes', `    IdentityFile ${keyFile}`);

    const passphrase = secretCrypto.decrypt(server.encryptedPassphrase);
    if (passphrase) {
      configureAskpass(tmpDir, env, passphrase);
    } else {
      configLines.push('    BatchMode yes');
    }
  } else {
    const password = secretCrypto.decrypt(server.encryptedPassword);
    if (!password) {
      throw new AppError('Server password is missing or could not be decrypted.', HTTP_STATUS.BAD_REQUEST);
    }

    configLines.push('    PubkeyAuthentication no', '    PreferredAuthentications password,keyboard-interactive');
    configureAskpass(tmpDir, env, password);
  }

  fs.writeFileSync(path.join(sshDir, 'config'), `${configLines.join('\n')}\n`, { mode: 0o600 });

  return {
    env,
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    },
  };
};

const runDiscoveryScript = async (server: IServerConnection) => {
  const scriptPath = resolveScriptPath();
  const { env, cleanup } = prepareScriptRun(server);

  try {
    const { stdout } = await execFileAsync('bash', [scriptPath], {
      env,
      timeout: DISCOVERY_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
    return stdout;
  } catch (error) {
    // The script's ssh step may exit non-zero even after the CSV was printed; use the
    // partial stdout when present, otherwise surface the failure.
    const partialStdout = (error as { stdout?: string }).stdout || '';
    if (partialStdout.trim()) {
      return partialStdout;
    }

    const stderr = (error as { stderr?: string }).stderr?.trim();
    const message = stderr || (error as Error).message || 'Remote project discovery failed.';
    throw new AppError(message, HTTP_STATUS.SERVICE_UNAVAILABLE);
  } finally {
    cleanup();
  }
};

export const serverProjectService = {
  async discover(server: IServerConnection) {
    const stdout = await runDiscoveryScript(server);
    return parseDiscoveryOutput(stdout);
  },

  async list(serverId: string) {
    return ServerProject.find({ server: new Types.ObjectId(serverId), active: true })
      .sort({ projectName: 1 })
      .lean();
  },

  async sync(serverId: string) {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new AppError('Server not found.', HTTP_STATUS.NOT_FOUND);
    }

    const stdout = await runDiscoveryScript(server);

    // TEMP DIAGNOSTIC: reveals exactly what the remote script returns so we can tell whether
    // empty port/db values are a parsing issue or the remote data itself (e.g. unreadable .env).
    const previewLines = stdout.split('\n').slice(0, 4).map((line) => JSON.stringify(line));
    logger.info(`[project-discovery] raw output (${stdout.length} bytes), first lines: ${previewLines.join(' | ')}`);

    const discovered = parseDiscoveryOutput(stdout);
    logger.info(
      `[project-discovery] parsed ${discovered.length} project(s); sample: ${JSON.stringify(discovered.slice(0, 3))}`,
    );

    if (discovered.length) {
      const now = new Date();
      await ServerProject.bulkWrite(
        discovered.map((project) => ({
          updateOne: {
            filter: { server: server._id, projectName: project.projectName },
            update: {
              $set: {
                portNumber: project.portNumber,
                projectPath: project.projectPath,
                dbUser: project.dbUser,
                databaseName: project.databaseName,
                dbType: project.dbType,
                dbHost: project.dbHost,
                dbPort: project.dbPort,
                configFile: project.configFile,
                discoveryStatus: project.discoveryStatus,
                nginxFile: project.nginxFile,
                active: true,
                updated: now,
              },
              $setOnInsert: {
                server: server._id,
                projectName: project.projectName,
                created: now,
              },
            },
            upsert: true,
          },
        })),
      );
    }

    logger.info(`Project discovery for ${server.host} found ${discovered.length} project(s).`);

    return this.list(serverId);
  },
};
