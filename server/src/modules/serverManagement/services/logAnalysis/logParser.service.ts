import crypto from 'crypto';
import { SupportedLogSource } from '../../models/logAnalysis.model';
import { logClassifierService } from './logClassifier.service';

export interface ParsedLogLine {
  source: SupportedLogSource;
  path?: string;
  line: string;
  timestamp: Date;
  host?: string;
  service?: string;
  pid?: string;
  actor?: string;
  ipAddress?: string;
  rawMessage: string;
  normalizedPattern: string;
  displayMessage: string;
  fingerprint: string;
}

interface ParseInput {
  source: SupportedLogSource;
  line: string;
  path?: string;
  fallbackTimestamp?: Date;
}

const monthIndex: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const normalizeMessage = (message: string) =>
  message
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b\d+\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

const cleanDisplayMessage = (message: string) =>
  message
    .replace(/<\/?(?:num|ip|path|hex)>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const fingerprintFor = (source: SupportedLogSource, normalizedPattern: string, service?: string) =>
  crypto
    .createHash('sha256')
    .update([source, service || '', normalizedPattern].join('|'))
    .digest('hex');

const parseSyslogTimestamp = (month: string, day: string, time: string) => {
  const now = new Date();
  const parsed = new Date(
    now.getFullYear(),
    monthIndex[month] ?? now.getMonth(),
    Number(day),
    Number(time.slice(0, 2)),
    Number(time.slice(3, 5)),
    Number(time.slice(6, 8)),
  );

  if (parsed.getTime() - now.getTime() > 1000 * 60 * 60 * 24 * 30) {
    parsed.setFullYear(parsed.getFullYear() - 1);
  }

  return parsed;
};

const firstIp = (value: string) => value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];

export const logParserService = {
  parse(input: ParseInput): ParsedLogLine {
    const line = input.line.trim();
    const fallbackTimestamp = input.fallbackTimestamp || new Date();
    let timestamp = fallbackTimestamp;
    let host: string | undefined;
    let service: string | undefined;
    let pid: string | undefined;
    let rawMessage = line;

    const syslogMatch = line.match(/^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:\[]+)(?:\[(\d+)])?:\s*(.*)$/);
    const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(.*)$/);
    const nginxApacheMatch = line.match(/^(\S+) \S+ \S+ \[([^\]]+)] "([^"]*)" (\d{3}) \S+(?: "([^"]*)" "([^"]*)")?/);

    if (syslogMatch) {
      timestamp = parseSyslogTimestamp(syslogMatch[1], syslogMatch[2], syslogMatch[3]);
      host = syslogMatch[4];
      service = syslogMatch[5]?.trim();
      pid = syslogMatch[6];
      rawMessage = syslogMatch[7] || line;
    } else if (isoMatch) {
      const date = new Date(isoMatch[1]);
      timestamp = Number.isNaN(date.getTime()) ? fallbackTimestamp : date;
      rawMessage = isoMatch[2];
    } else if (nginxApacheMatch) {
      const date = new Date(nginxApacheMatch[2].replace(':', ' '));
      timestamp = Number.isNaN(date.getTime()) ? fallbackTimestamp : date;
      service = input.source;
      rawMessage = `${nginxApacheMatch[3]} status=${nginxApacheMatch[4]}`;
    }

    const normalizedPattern = normalizeMessage(rawMessage);
    const displayMessage = cleanDisplayMessage(rawMessage);

    return {
      source: input.source,
      path: input.path,
      line,
      timestamp,
      host,
      service,
      pid,
      actor: rawMessage.match(/user\s+(\S+)/i)?.[1],
      ipAddress: firstIp(line),
      rawMessage,
      normalizedPattern,
      displayMessage,
      fingerprint: fingerprintFor(input.source, normalizedPattern, service),
    };
  },

  parseMany(inputs: ParseInput[]) {
    return inputs.filter((input) => input.line.trim()).map((input) => this.parse(input));
  },

  classifyParsed(parsed: ParsedLogLine) {
    return logClassifierService.classify(parsed.rawMessage, parsed.source);
  },
};
