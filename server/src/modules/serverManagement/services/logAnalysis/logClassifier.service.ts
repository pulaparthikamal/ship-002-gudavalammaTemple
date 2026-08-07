import { LogSeverity, SupportedLogSource } from '../../models/logAnalysis.model';

export interface LogClassification {
  severity: LogSeverity;
  category: string;
  tags: string[];
  confidence: number;
  rootCauseSuggestion?: string;
}

const securityPatterns = [
  /failed password/i,
  /authentication failure/i,
  /invalid user/i,
  /sudo:.*authentication failure/i,
  /possible break-in attempt/i,
  /permission denied/i,
  /\b401\b|\b403\b/,
  /blocked|firewall|brute force/i,
];

const criticalPatterns = [
  /kernel panic/i,
  /out of memory|oom-killer/i,
  /segmentation fault/i,
  /fatal/i,
  /emergency/i,
  /service unavailable|\b503\b/i,
  /database.*(down|unavailable|corrupt)/i,
];

const errorPatterns = [
  /\berror\b/i,
  /\bfailed\b/i,
  /\bexception\b/i,
  /\bpanic\b/i,
  /\btimeout\b/i,
  /\b5\d\d\b/,
  /connection refused/i,
];

const warnPatterns = [
  /\bwarn(?:ing)?\b/i,
  /\bdeprecated\b/i,
  /\bretry\b/i,
  /\bslow\b/i,
  /\b4\d\d\b/,
  /disk.*(high|full|space)/i,
];

const sourceCategory: Record<SupportedLogSource, string> = {
  syslog: 'system',
  auth: 'security',
  nginx: 'web',
  apache: 'web',
  application: 'application',
  docker: 'container',
  kernel: 'kernel',
  journald: 'systemd',
};

const getRootCauseSuggestion = (message: string, source: SupportedLogSource, severity: LogSeverity) => {
  if (/failed password|invalid user|authentication failure/i.test(message)) {
    return 'Review authentication attempts, source IP reputation, SSH exposure, and rate limiting.';
  }
  if (/out of memory|oom-killer/i.test(message)) {
    return 'Investigate memory pressure, process growth, swap availability, and recent deployments.';
  }
  if (/disk.*(full|space)|no space left/i.test(message)) {
    return 'Check log growth, temp files, retention settings, and disk allocation for the affected mount.';
  }
  if (/connection refused|upstream.*failed|service unavailable|\b503\b/i.test(message)) {
    return 'Validate upstream service health, listener ports, recent restarts, and dependency availability.';
  }
  if (/timeout|slow/i.test(message)) {
    return 'Review network latency, database/query duration, upstream saturation, and timeout thresholds.';
  }
  if (source === 'kernel' || severity === 'CRITICAL') {
    return 'Correlate kernel/system events with resource metrics, hardware signals, and service restarts.';
  }

  return 'Correlate this pattern with recent deployments, resource spikes, and dependent service health.';
};

export const logClassifierService = {
  classify(message: string, source: SupportedLogSource): LogClassification {
    const tags = [sourceCategory[source]];
    let severity: LogSeverity = 'INFO';
    let confidence = 0.65;

    if (securityPatterns.some((pattern) => pattern.test(message)) || source === 'auth') {
      severity = 'SECURITY';
      tags.push('security');
      confidence = 0.88;
    } else if (criticalPatterns.some((pattern) => pattern.test(message))) {
      severity = 'CRITICAL';
      tags.push('availability');
      confidence = 0.86;
    } else if (errorPatterns.some((pattern) => pattern.test(message))) {
      severity = 'ERROR';
      tags.push('failure');
      confidence = 0.78;
    } else if (warnPatterns.some((pattern) => pattern.test(message))) {
      severity = 'WARN';
      tags.push('warning');
      confidence = 0.72;
    }

    const category = severity === 'SECURITY' ? 'security' : sourceCategory[source];

    return {
      severity,
      category,
      tags: Array.from(new Set(tags)),
      confidence,
      rootCauseSuggestion:
        severity === 'INFO' ? undefined : getRootCauseSuggestion(message, source, severity),
    };
  },
};
