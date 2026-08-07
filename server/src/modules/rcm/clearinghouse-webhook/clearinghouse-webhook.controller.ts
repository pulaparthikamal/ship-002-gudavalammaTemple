import { Request, Response } from 'express';
import respUtil from '../../../utils/resp.util';
import { clearinghouseWebhookService } from './clearinghouse-webhook.service';
import { ClearinghouseEventType } from '../clearinghouse-event/clearinghouse-event.model';

async function receive(req: Request, res: Response, fallbackEventType: ClearinghouseEventType, source: string) {
  const result = await clearinghouseWebhookService.receiveEvent({
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
    rawBody: (req as any).rawBody,
    fallbackEventType,
    source,
  });

  req.entityType = 'clearinghouseWebhook';
  (req as any).clearinghouseWebhook = {
    duplicate: result.duplicate,
    clearinghouseEventId: result.clearinghouseEvent._id,
    jobId: result.job?._id,
    status: result.clearinghouseEvent.status,
  };

  return res.status(result.duplicate ? 200 : 202).json(
    respUtil.dataSuccessResponse(
      req,
      {
        duplicate: result.duplicate,
        clearinghouseEventId: result.clearinghouseEvent._id,
        eventType: result.clearinghouseEvent.eventType,
        eventStatus: result.clearinghouseEvent.status,
        jobId: result.job?._id,
        jobStatus: result.job?.status,
      },
      result.duplicate ? 'Clearinghouse event was already received.' : 'Clearinghouse event accepted for processing.'
    )
  );
}

export const clearinghouseWebhookController = {
  async acknowledgements(req: Request, res: Response) {
    const explicitType: ClearinghouseEventType = String(req.body?.responseType ?? req.body?.acknowledgementType ?? '').includes('999')
      ? 'ACK_999'
      : 'ACK_277CA';
    return receive(req, res, explicitType, 'clearinghouse-acknowledgement-webhook');
  },

  async era835(req: Request, res: Response) {
    return receive(req, res, 'ERA_835', 'clearinghouse-835-webhook');
  },

  async claimStatus(req: Request, res: Response) {
    return receive(req, res, 'CLAIM_STATUS', 'clearinghouse-status-webhook');
  },

  async generic(req: Request, res: Response) {
    return receive(req, res, 'UNKNOWN', 'clearinghouse-generic-webhook');
  },
};
