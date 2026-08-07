import { SupportedLogSource } from '../../models/logAnalysis.model';

export interface LogRetentionPolicy {
  source: SupportedLogSource;
  archiveAfterDays: number;
  deleteAfterDays: number;
  archiveBeforeDelete: boolean;
}

export interface LogRetentionPolicyOverrides {
  archiveOlderThanDays?: number;
  deleteOlderThanDays?: number;
}

const defaultPolicies: Record<SupportedLogSource, LogRetentionPolicy> = {
  syslog: { source: 'syslog', archiveAfterDays: 30, deleteAfterDays: 365, archiveBeforeDelete: true },
  auth: { source: 'auth', archiveAfterDays: 90, deleteAfterDays: 730, archiveBeforeDelete: true },
  nginx: { source: 'nginx', archiveAfterDays: 30, deleteAfterDays: 365, archiveBeforeDelete: true },
  apache: { source: 'apache', archiveAfterDays: 30, deleteAfterDays: 365, archiveBeforeDelete: true },
  application: { source: 'application', archiveAfterDays: 45, deleteAfterDays: 365, archiveBeforeDelete: true },
  docker: { source: 'docker', archiveAfterDays: 30, deleteAfterDays: 365, archiveBeforeDelete: true },
  kernel: { source: 'kernel', archiveAfterDays: 90, deleteAfterDays: 730, archiveBeforeDelete: true },
  journald: { source: 'journald', archiveAfterDays: 30, deleteAfterDays: 365, archiveBeforeDelete: true },
};

export const retentionPolicyService = {
  getPolicy(source: SupportedLogSource, overrides: LogRetentionPolicyOverrides = {}): LogRetentionPolicy {
    const policy = defaultPolicies[source];
    return {
      ...policy,
      archiveAfterDays: overrides.archiveOlderThanDays ?? policy.archiveAfterDays,
      deleteAfterDays: overrides.deleteOlderThanDays ?? policy.deleteAfterDays,
    };
  },

  listPolicies(overrides: LogRetentionPolicyOverrides = {}): LogRetentionPolicy[] {
    return Object.values(defaultPolicies).map((policy) => this.getPolicy(policy.source, overrides));
  },

  getCutoff(days: number, from = new Date()) {
    return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
  },
};
