import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { selfHealingService } from './selfHealing.service';
import { ServerConnection } from '../models/serverConnection.model';
import { RemediationJob } from '../models/remediationJob.model';
import { Alert } from '../models/alert.model';
import { ServerMaintenanceConfig } from '../models/config.model';
import { CrashHistory } from '../models/crashHistory.model';
import { MetricsHistory } from '../models/metricsHistory.model';
import { Prediction } from '../models/prediction.model';
import { Anomaly } from '../models/anomaly.model';
import { ScanResult } from '../models/scanResult.model';
import { Metric } from '../models/metric.model';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { remediationToolsService } from './remediationTools.service';
import { alertService } from './alert.service';
import { incidentService } from './incident.service';
import { agentService } from './agent.service';
import { socketService } from './socket.service';
import { healthService } from './health.service';
import { sendMail } from '../../../utils/mail.util';

// Mock mail util
jest.mock('../../../utils/mail.util', () => ({
  sendMail: (jest.fn() as any).mockResolvedValue(undefined),
}));

describe('Auto Restart & Self-Healing System Tests', () => {
  const mockServerId = new Types.ObjectId().toString();
  const mockServer = {
    _id: new Types.ObjectId(mockServerId),
    name: 'Test Production Server',
    host: '127.0.0.1',
    port: 22,
    active: true,
    status: 'active',
    email: 'ops-admin@test.com',
  };

  const mockConfig = {
    server: new Types.ObjectId(mockServerId),
    automationEnabled: true,
    maxRestartAttempts: 3,
    restartCooldownMinutes: 1,
    slackWebhookUrl: 'https://hooks.slack.com/services/test/webhook',
    telegramBotToken: '123456:bot-token',
    telegramChatId: '987654321',
    scanDirectories: ['/var/log', '/tmp'],
    ignoreFolders: ['/var/log/ignored'],
    deleteOlderThanDays: 7,
    archiveLargeFileMb: 100,
    largeFileMb: 50,
    unusedFileDays: 14,
    rules: [],
  };

  let emitStatusUpdateSpy: any;
  let metricsFindOneSpy: any;
  let fetchMock: any;
  let serverFindByIdSpy: any;
  let configFindOneSpy: any;
  let jobCreateSpy: any;
  let crashCreateSpy: any;
  let alertFindOneSpy: any;
  let alertCreateSpy: any;
  let incidentAnalyzeSpy: any;

  // New global spies for AI prediction telemetry models
  let metricFindSpy: any;
  let scanResultFindOneSpy: any;
  let scanResultFindSpy: any;
  let maintenanceLogFindSpy: any;
  let healthScoreSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    selfHealingService.resetRuntimeStateForTests();
    fetchMock = (jest.fn() as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    global.fetch = fetchMock as any;

    // Globally mock status updates and metric checks to prevent Mongoose database connection buffering
    emitStatusUpdateSpy = jest.spyOn(selfHealingService, 'emitStatusUpdate').mockImplementation(() => {});
    metricsFindOneSpy = jest.spyOn(MetricsHistory, 'findOne').mockReturnValue({
      sort: () => ({
        lean: async () => null,
      }),
    } as any);

    // Global default Mongoose model query spies
    serverFindByIdSpy = jest.spyOn(ServerConnection, 'findById').mockResolvedValue(mockServer as any);
    configFindOneSpy = jest.spyOn(ServerMaintenanceConfig, 'findOne').mockResolvedValue(mockConfig as any);
    
    // Dynamic document mock generator to support arbitrary document schemas and deep nesting (like steps)
    jobCreateSpy = jest.spyOn(RemediationJob, 'create').mockImplementation(async (data: any) => {
      return {
        ...data,
        _id: new Types.ObjectId(),
        save: async function(this: any) { return this; },
      } as any;
    });

    crashCreateSpy = jest.spyOn(CrashHistory, 'create').mockResolvedValue({} as any);
    alertFindOneSpy = jest.spyOn(Alert, 'findOne').mockResolvedValue(null as any);
    alertCreateSpy = jest.spyOn(Alert, 'create').mockResolvedValue({ _id: new Types.ObjectId() } as any);
    incidentAnalyzeSpy = jest.spyOn(incidentService, 'analyze').mockResolvedValue({} as any);

    // Setup global spies for AI prediction dependencies
    metricFindSpy = jest.spyOn(Metric, 'find').mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    } as any);
    scanResultFindOneSpy = jest.spyOn(ScanResult, 'findOne').mockReturnValue({
      select: () => ({
        sort: () => ({
          lean: async () => null,
        }),
      }),
    } as any);
    scanResultFindSpy = jest.spyOn(ScanResult, 'find').mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    } as any);
    maintenanceLogFindSpy = jest.spyOn(MaintenanceLog, 'find').mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    } as any);
    healthScoreSpy = jest.spyOn(healthService, 'calculateScore').mockResolvedValue(85);

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    emitStatusUpdateSpy.mockRestore();
    metricsFindOneSpy.mockRestore();
    serverFindByIdSpy.mockRestore();
    configFindOneSpy.mockRestore();
    jobCreateSpy.mockRestore();
    crashCreateSpy.mockRestore();
    alertFindOneSpy.mockRestore();
    alertCreateSpy.mockRestore();
    incidentAnalyzeSpy.mockRestore();
    metricFindSpy.mockRestore();
    scanResultFindOneSpy.mockRestore();
    scanResultFindSpy.mockRestore();
    maintenanceLogFindSpy.mockRestore();
    healthScoreSpy.mockRestore();
  });

  describe('1. Crash Detection & Recovery Flows', () => {
    it('detects a failed PM2/systemd service and triggers automated restart healing', async () => {
      // Arrange
      const metric = {
        serviceSummary: {
          failedServices: ['pm2:api-worker'],
          serviceIssues: [
            {
              service: 'pm2:api-worker',
              manager: 'pm2',
              status: 'stopped',
              reason: 'user manually stopped the service',
            },
          ],
        },
      };

      let activeChecks = 0;
      const executeSpy = jest
        .spyOn(remediationToolsService, 'executeToolCall')
        .mockImplementation(async (server, tool) => {
          if (tool.toolName === 'custom_command') {
            activeChecks += 1;
            return activeChecks === 1
              ? { code: 1, stdout: 'stopped', stderr: 'process offline' }
              : { code: 0, stdout: 'online', stderr: '' };
          }
          if (tool.toolName === 'restart_service') {
            return { code: 0, stdout: 'PM2 process restarted successfully', stderr: '' };
          }
          if (tool.toolName === 'run_health_check') {
            return { code: 0, stdout: 'All systems operational', stderr: '' };
          }
          return { code: 0, stdout: '', stderr: '' };
        });

      // Act
      await selfHealingService.evaluate(mockServerId, metric, 95);
      
      // Allow async void triggers to execute in macro-task queue
      await jest.runAllTimersAsync();

      // Assert
      expect(serverFindByIdSpy).toHaveBeenCalledWith(mockServerId);
      expect(jobCreateSpy).toHaveBeenCalled();
      expect(crashCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'api-worker',
          serviceType: 'pm2',
          reason: 'user manually stopped the service',
        })
      );
      expect(executeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toolName: 'restart_service' })
      );
      expect(alertCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'remediation_completed',
          severity: 'success',
        })
      );
    });

    it('skips restart when pre-flight check determines service has self-healed', async () => {
      const metric = {
        serviceSummary: {
          failedServices: ['pm2:api-worker'],
        },
      };

      // Mock tool calls: active check returns 'online' (healthy)
      jest.spyOn(remediationToolsService, 'executeToolCall').mockResolvedValue({
        code: 0,
        stdout: 'online',
        stderr: '',
      });

      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      // Should skip executing the actual restart tool and record skipped job
      expect(jobCreateSpy).toHaveBeenCalled();
      expect(alertCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'remediation_completed',
          title: 'Healing Execution Skipped',
        })
      );
    });
  });

  describe('2. Auto-Restart Loop Prevention & Cooldowns', () => {
    it('halts healing and raises critical alert if restart attempts exceed threshold in the time window', async () => {
      const metric = {
        serviceSummary: {
          failedServices: ['systemd:nginx'],
        },
      };

      jest.spyOn(remediationToolsService, 'executeToolCall').mockImplementation(async (server, tool) => {
        if (tool.toolName === 'custom_command') {
          return { code: 1, stdout: 'inactive', stderr: '' }; // remains failed
        }
        return { code: 0, stdout: 'restarted', stderr: '' };
      });

      // Trigger 1st restart
      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      // Fast forward past the 1-minute cooldown, but stay within the 10-minute window
      jest.advanceTimersByTime(65 * 1000); 

      // Trigger 2nd restart
      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(65 * 1000);

      // Trigger 3rd restart
      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();
      jest.advanceTimersByTime(65 * 1000);

      // Trigger 4th restart -> should exceed maxRestartAttempts (3) and trigger loop prevention
      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      expect(alertCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'remediation_failed',
          severity: 'critical',
          title: 'Healing Loop Suspended',
          message: expect.stringContaining('threshold (3 failures in 10 minutes)'),
        })
      );
    });
  });

  describe('3. AI-Based Failure Prediction & Anomaly Forecasting', () => {
    it('predicts RAM leak and raises anomaly based on rising RSS telemetry history', async () => {
      // Arrange (Newest first, to reverse into ascending order)
      const mockHistory = [
        { memoryUsagePercent: 82, collectedAt: new Date() },
        { memoryUsagePercent: 75, collectedAt: new Date(Date.now() - 5000) },
        { memoryUsagePercent: 70, collectedAt: new Date(Date.now() - 10000) },
        { memoryUsagePercent: 65, collectedAt: new Date(Date.now() - 15000) },
        { memoryUsagePercent: 60, collectedAt: new Date(Date.now() - 20000) },
      ];

      jest.spyOn(MetricsHistory, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => mockHistory,
          }),
        }),
      } as any);

      jest.spyOn(CrashHistory, 'find').mockReturnValue({
        lean: async () => [],
      } as any);

      const predictionCreateSpy = jest
        .spyOn(Prediction, 'create')
        .mockResolvedValue({ _id: new Types.ObjectId() } as any);

      const anomalyInsertSpy = jest
        .spyOn(Anomaly, 'insertMany')
        .mockResolvedValue([] as any);

      // Act
      await agentService.predictMaintenance(mockServerId);

      // Assert
      expect(predictionCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          predictions: expect.arrayContaining([
            expect.objectContaining({
              issue: 'Proactive Memory Leak Warning',
              severity: 'high',
            }),
          ]),
        })
      );
      expect(anomalyInsertSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'memory_leak',
            title: 'Memory Leak Risk Pattern',
          }),
        ])
      );
    });

    it('projects storage exhaustion horizon and estimates time to full filesystem saturation', async () => {
      // Arrange (Newest first, to reverse into ascending order)
      const mockHistory = [
        { diskUsagePercent: 85, collectedAt: new Date() },             // Now
        { diskUsagePercent: 82, collectedAt: new Date(Date.now() - 5 * 60000) },  // 5 mins ago
        { diskUsagePercent: 80, collectedAt: new Date(Date.now() - 10 * 60000) }, // 10 mins ago
      ];

      jest.spyOn(MetricsHistory, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => mockHistory,
          }),
        }),
      } as any);

      jest.spyOn(CrashHistory, 'find').mockReturnValue({
        lean: async () => [],
      } as any);

      const predictionCreateSpy = jest
        .spyOn(Prediction, 'create')
        .mockResolvedValue({ _id: new Types.ObjectId() } as any);

      // Act
      await agentService.predictMaintenance(mockServerId);

      // Assert
      expect(predictionCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          predictions: expect.arrayContaining([
            expect.objectContaining({
              issue: 'Storage Saturation Horizon Projection',
              severity: 'high',
            }),
          ]),
        })
      );
    });

    it('detects repeated daemon crash patterns and flags service loop threat', async () => {
      // Arrange
      const mockHistory = [
        { memoryUsagePercent: 40, collectedAt: new Date() },
      ];
      const mockCrashes = [
        { serviceName: 'background-worker', timestamp: new Date() },
        { serviceName: 'background-worker', timestamp: new Date() },
      ];

      jest.spyOn(MetricsHistory, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => mockHistory,
          }),
        }),
      } as any);

      jest.spyOn(CrashHistory, 'find').mockReturnValue({
        lean: async () => mockCrashes,
      } as any);

      const predictionCreateSpy = jest
        .spyOn(Prediction, 'create')
        .mockResolvedValue({ _id: new Types.ObjectId() } as any);

      // Act
      await agentService.predictMaintenance(mockServerId);

      // Assert
      expect(predictionCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          predictions: expect.arrayContaining([
            expect.objectContaining({
              issue: 'Repeated Daemon Crash Pattern: background-worker',
              severity: 'critical',
            }),
          ]),
        })
      );
    });
  });

  describe('4. Self-Healing Action Workflows', () => {
    it('executes cache flush drop-caches command on memory pressure > 95%', async () => {
      const metric = {
        memoryUsagePercent: 98,
      };

      const executeSpy = jest
        .spyOn(remediationToolsService, 'executeToolCall')
        .mockResolvedValue({ code: 0, stdout: 'Cache dropped successfully', stderr: '' });

      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      expect(jobCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'clear_cache',
          target: 'memory',
        })
      );
      expect(executeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toolName: 'clear_cache' })
      );
    });

    it('triggers directory space reclamation scan on disk exhaustion > 95%', async () => {
      const metric = {
        diskUsagePercent: 97,
      };

      const executeSpy = jest
        .spyOn(remediationToolsService, 'executeToolCall')
        .mockImplementation(async (server, tool) => {
          if (tool.toolName === 'start_scan') {
            return { code: 0, stdout: JSON.stringify({ scanId: 'scan123' }), stderr: '' };
          }
          if (tool.toolName === 'apply_scan_cleanup') {
            return { code: 0, stdout: JSON.stringify({ spaceReclaimedMb: 450.5 }), stderr: '' };
          }
          return { code: 0, stdout: '', stderr: '' };
        });

      await selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      expect(jobCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'archive_file',
          target: 'disk_space',
        })
      );
      expect(executeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toolName: 'start_scan' })
      );
      expect(executeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toolName: 'apply_scan_cleanup', args: { scanId: 'scan123' } })
      );
    });
  });

  describe('5. Deduplicated Alert Notifications', () => {
    it('sends Slack and Telegram webhooks and deduplicates matching alerts in a 15-minute window', async () => {
      // Arrange
      alertFindOneSpy
        .mockResolvedValueOnce(null as any) // 1st alert: not found
        .mockResolvedValueOnce({
          _id: new Types.ObjectId(),
          metadata: { occurrenceCount: 1 },
          save: (jest.fn() as any).mockResolvedValue(true),
        } as any); // 2nd alert: found duplicate

      alertCreateSpy.mockResolvedValue({ _id: new Types.ObjectId() } as any);

      // Act - First warning alert
      await alertService.create({
        serverId: mockServerId,
        type: 'remediation_failed',
        severity: 'critical',
        title: 'Healing Loop Suspended',
        message: 'Critical error message',
      });

      // Assert SMTP & Webhook calls for 1st alert
      expect(alertCreateSpy).toHaveBeenCalled();
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ops-admin@test.com',
          subject: '[CRITICAL] Healing Loop Suspended',
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('[CRITICAL] Healing Loop Suspended'),
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('🚨 *[CRITICAL] Healing Loop Suspended*'),
        })
      );

      // Clear calls
      jest.clearAllMocks();

      // Act - Second warning alert within 15 minutes
      await alertService.create({
        serverId: mockServerId,
        type: 'remediation_failed',
        severity: 'critical',
        title: 'Healing Loop Suspended',
        message: 'Critical error message',
      });

      // Assert deduplication: Alert.findOne was called, and Alert.create was NOT called
      expect(alertFindOneSpy).toHaveBeenCalled();
      expect(alertCreateSpy).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled(); // No additional email sent
    });
  });

  describe('6. Real-Time Dashboard Updates & WebSocket Aggregation', () => {
    it('compiles healing status history matrices and broadcasts SELF_HEALING_UPDATE updates', async () => {
      // Restore the spy to test the real implementation
      emitStatusUpdateSpy.mockRestore();

      // Arrange
      const mockJobs = [
        { type: 'restart_service', status: 'completed', created: new Date() },
        { type: 'restart_service', status: 'failed', created: new Date() },
      ];

      jest.spyOn(RemediationJob, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => mockJobs,
          }),
        }),
      } as any);

      jest.spyOn(Alert, 'countDocuments').mockResolvedValue(2);
      
      jest.spyOn(MetricsHistory, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => ({
            sshSessionActivity: { loggedInUsers: 1 },
          }),
        }),
      } as any);

      const emitSpy = jest.spyOn(socketService, 'emitToServer').mockImplementation(() => {});

      // Act
      const status = await selfHealingService.getStatus(mockServerId);

      // Assert
      expect(status).toEqual(
        expect.objectContaining({
          uptime: 'Online',
          restartCount: 1,
          activeIncidents: 2,
          stabilityIndicator: 'warning',
        })
      );

      selfHealingService.emitStatusUpdate(mockServerId);
      await jest.runAllTimersAsync();

      expect(emitSpy).toHaveBeenCalledWith(
        mockServerId,
        'SELF_HEALING_UPDATE',
        expect.objectContaining({
          stabilityIndicator: 'warning',
        })
      );
    });
  });

  describe('7. Performance & Reentrancy Stability Locks', () => {
    it('enforces reentrancy locks and blocks double execution of in-flight remediation jobs', async () => {
      const metric = {
        serviceSummary: {
          failedServices: ['pm2:api-worker'],
        },
      };

      jest.spyOn(remediationToolsService, 'executeToolCall').mockImplementation(() => new Promise(() => {})); // hung command

      // Trigger first execution -> locks PM2 service restart
      selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      expect(jobCreateSpy).toHaveBeenCalledTimes(1);

      // Trigger second execution concurrently -> should be blocked by inFlightJobs lock
      selfHealingService.evaluate(mockServerId, metric, 95);
      await jest.runAllTimersAsync();

      expect(jobCreateSpy).toHaveBeenCalledTimes(1); // Still 1, didn't run twice
    });
  });
});
