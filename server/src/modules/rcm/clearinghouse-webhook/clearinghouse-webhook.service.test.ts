import crypto from 'crypto';
import { claimSubmissionIntegrationConfig } from '../claim-submission/claim-submission.integration.config';
import {
  enforceClearinghouseWebhookReplayWindow,
  verifyClearinghouseWebhookSignature,
} from './clearinghouse-webhook.service';

describe('clearinghouse webhook verification', () => {
  const originalWebhookConfig = { ...claimSubmissionIntegrationConfig.webhook };
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    Object.assign(claimSubmissionIntegrationConfig.webhook as any, originalWebhookConfig);
    process.env.NODE_ENV = originalNodeEnv;
    jest.useRealTimers();
  });

  it('accepts configurable Stedi signature and timestamp headers', () => {
    const rawBody = JSON.stringify({ eventId: 'evt-1', eventType: '277CA' });
    const secret = 'stedi-test-secret';
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    Object.assign(claimSubmissionIntegrationConfig.webhook as any, {
      secret,
      signatureHeader: 'x-custom-stedi-signature',
      timestampHeader: 'x-custom-stedi-timestamp',
      toleranceSeconds: 300,
    });

    enforceClearinghouseWebhookReplayWindow({
      'x-custom-stedi-timestamp': String(Date.now()),
    });

    expect(verifyClearinghouseWebhookSignature({
      'x-custom-stedi-signature': `sha256=${signature}`,
    }, rawBody)).toBe(true);
  });

  it('rejects invalid signatures in production', () => {
    process.env.NODE_ENV = 'production';
    Object.assign(claimSubmissionIntegrationConfig.webhook as any, {
      secret: 'stedi-test-secret',
      signatureHeader: 'x-stedi-signature',
    });

    expect(() => verifyClearinghouseWebhookSignature({
      'x-stedi-signature': 'sha256=bad',
    }, '{"eventId":"evt-2"}')).toThrow('Clearinghouse webhook signature or secret is invalid.');
  });

  it('rejects timestamps outside the replay tolerance window', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    Object.assign(claimSubmissionIntegrationConfig.webhook as any, {
      timestampHeader: 'x-stedi-created-at',
      toleranceSeconds: 60,
    });

    expect(() => enforceClearinghouseWebhookReplayWindow({
      'x-stedi-created-at': String(Date.parse('2026-05-20T11:30:00.000Z')),
    })).toThrow('Clearinghouse webhook timestamp is outside the replay window.');
  });

  it('rejects signed webhook processing when timestamp is missing', () => {
    Object.assign(claimSubmissionIntegrationConfig.webhook as any, {
      secret: 'stedi-test-secret',
      timestampHeader: 'x-stedi-created-at',
    });

    expect(() => enforceClearinghouseWebhookReplayWindow({}))
      .toThrow('Clearinghouse webhook timestamp is required when webhook signing is configured.');
  });
});
