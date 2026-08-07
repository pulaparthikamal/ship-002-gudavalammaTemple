import { envConfig } from '../../../config/env.config';
import { attachRcmEventStream, isReportInvalidatingEvent, publishRcmRealtimeEvent } from './rcm-event-stream.service';

jest.mock('./rcm-event-log.model', () => ({
  RcmEventLog: {
    create: jest.fn().mockResolvedValue({}),
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    })),
  },
}));

function createMockResponse() {
  const listeners = new Map<string, () => void>();
  type MockResponse = {
    headers: Record<string, string>;
    chunks: string[];
    statusCode?: number;
    setHeader: jest.Mock;
    write: jest.Mock;
    flushHeaders: jest.Mock;
    status: jest.Mock;
    end: jest.Mock;
    on: jest.Mock;
    close: () => void;
  };
  const response: MockResponse = {
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    statusCode: undefined as number | undefined,
    setHeader: jest.fn((key: string, value: string) => {
      response.headers[key] = value;
    }),
    write: jest.fn((chunk: string) => {
      response.chunks.push(chunk);
    }),
    flushHeaders: jest.fn(),
    status: jest.fn((statusCode: number): MockResponse => {
      response.statusCode = statusCode;
      return response;
    }),
    end: jest.fn(),
    on: jest.fn((event: string, listener: () => void) => {
      listeners.set(event, listener);
      return response;
    }),
    close: () => listeners.get('close')?.(),
  };

  return response;
}

describe('rcm-event-stream.service', () => {
  const originalRealtimeEnabled = envConfig.rcmRealtimeEnabled;
  const originalRealtimeMode = envConfig.rcmRealtimeMode;

  afterEach(() => {
    (envConfig as any).rcmRealtimeEnabled = originalRealtimeEnabled;
    (envConfig as any).rcmRealtimeMode = originalRealtimeMode;
    jest.clearAllMocks();
  });

  it('attaches an SSE client and publishes realtime RCM events', () => {
    (envConfig as any).rcmRealtimeEnabled = true;
    (envConfig as any).rcmRealtimeMode = 'sse';
    const response = createMockResponse();

    attachRcmEventStream(response as any);
    publishRcmRealtimeEvent({
      eventType: 'CLAIM_TRACKING_UPDATED',
      title: 'Tracking updated',
      claimId: 'claim-1',
      entityId: 'tracking-1',
      entityType: 'claimTracking',
      status: 'ACCEPTED',
    });

    expect(response.headers['Content-Type']).toBe('text/event-stream');
    expect(response.chunks.join('')).toContain('event: rcm-event');
    expect(response.chunks.join('')).toContain('id:');
    expect(response.chunks.join('')).toContain('CLAIM_TRACKING_UPDATED');
    response.close();
  });

  it('returns no-content when realtime SSE is disabled', () => {
    (envConfig as any).rcmRealtimeEnabled = false;
    const response = createMockResponse();

    attachRcmEventStream(response as any);

    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.end).toHaveBeenCalled();
  });

  it('invalidates report snapshots for new report-changing realtime events', () => {
    for (const eventType of [
      'AR_CLOSED_FROM_PAYMENT',
      'WEBHOOK_PROCESSED',
      'WEBHOOK_REJECTED',
      'AI_REVIEW_COMPLETED',
      'PATIENT_BILLING_CREATED',
      'COLLECTION_REFERRED',
      'FINANCIAL_RISK_CREATED',
      'UNSUPPORTED_ADJUSTMENT_DETECTED',
    ] as const) {
      expect(isReportInvalidatingEvent(eventType)).toBe(true);
    }
  });
});
