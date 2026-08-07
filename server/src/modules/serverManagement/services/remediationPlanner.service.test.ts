import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { remediationPlannerService } from './remediationPlanner.service';
import { ServerConnection } from '../models/serverConnection.model';
import { Alert } from '../models/alert.model';
import { Metric } from '../models/metric.model';
import { ScanResult } from '../models/scanResult.model';
import { configService } from './config.service';
import { healthService } from './health.service';

describe('remediationPlannerService', () => {
  const serverId = new Types.ObjectId().toString();
  const previousAgenticUrl = process.env.AGENTIC_SERVER_URL;
  const previousCrewAiUrl = process.env.CREWAI_API_URL;
  let spies: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    process.env.AGENTIC_SERVER_URL = '';
    process.env.CREWAI_API_URL = '';
    spies = [
      jest.spyOn(ServerConnection, 'findById').mockReturnValue({
        lean: async () => ({
          _id: serverId,
          name: 'prod',
          host: '127.0.0.1',
          status: 'connected',
        }),
      } as any),
      jest.spyOn(configService, 'get').mockResolvedValue({
        diskThresholdPercent: 90,
        cpuThresholdPercent: 90,
        memoryThresholdPercent: 90,
        archiveDirectory: '/tmp/archive',
        automationEnabled: true,
        scanDirectories: ['/tmp'],
        ignoreFolders: [],
      } as any),
      jest.spyOn(healthService, 'calculateScore').mockResolvedValue(90),
      jest.spyOn(Metric, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      } as any),
      jest.spyOn(Alert, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      } as any),
      jest.spyOn(ScanResult, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      } as any),
    ];
  });

  afterEach(() => {
    spies.forEach((spy) => spy.mockRestore());
    process.env.AGENTIC_SERVER_URL = previousAgenticUrl;
    process.env.CREWAI_API_URL = previousCrewAiUrl;
  });

  it('extracts the actual systemd unit from manual self-healing restart intent', async () => {
    const plan = await remediationPlannerService.buildPlan({
      serverId,
      intent: 'Restart systemd service janus.service',
      approvalMode: 'auto',
    });

    expect(plan.target).toBe('janus.service');
    expect(plan.requiresApproval).toBe(false);
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: 'restart_service',
          args: { serviceName: 'janus.service' },
        }),
      ]),
    );
  });

  it('overrides a bad external planner response for restart intents', async () => {
    process.env.CREWAI_API_URL = 'http://agentic.test/api/v1';
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          goal: 'Restart systemd service janus.service',
          summary: 'Incorrect storage plan',
          target: 'configured-directories',
          description: 'Incorrect storage plan',
          planner: 'external',
          decisionTrace: ['External planner returned a storage plan.'],
          riskLevel: 'medium',
          requiresApproval: false,
          steps: [{ toolName: 'start_scan', args: { includeFullServer: true } }],
          rollbackSteps: [],
        },
      }),
    } as any);

    const plan = await remediationPlannerService.buildPlan({
      serverId,
      intent: 'Restart systemd service janus.service',
      approvalMode: 'auto',
    });

    expect(plan.target).toBe('janus.service');
    expect(plan.steps).toEqual([
      { toolName: 'run_health_check', args: {} },
      { toolName: 'restart_service', args: { serviceName: 'janus.service' } },
      { toolName: 'run_health_check', args: {} },
    ]);
    expect(plan.decisionTrace).toEqual(
      expect.arrayContaining([
        'Restart intent normalized to direct service restart target "janus.service".',
      ]),
    );

    fetchSpy.mockRestore();
  });
});
