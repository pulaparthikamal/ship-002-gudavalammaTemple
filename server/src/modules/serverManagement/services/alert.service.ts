import { Types } from 'mongoose';
import { sendMail } from '../../../utils/mail.util';
import { logger } from '../../../utils/logger.util';
import { Alert, AlertSeverity, AlertType } from '../models/alert.model';
import { ServerConnection } from '../models/serverConnection.model';
import { ServerMaintenanceConfig } from '../models/config.model';
import { socketService } from './socket.service';

export interface CreateAlertPayload {
  serverId: string | Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  email?: boolean;
}

const buildEmailHtml = (title: string, message: string, metadata: Record<string, unknown>) => `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
    <h2>${title}</h2>
    <p>${message}</p>
    <pre style="background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap">${JSON.stringify(
  metadata,
  null,
  2
)}</pre>
  </div>
`;

const MAIL_SUPPRESSION_MS = 60 * 60 * 1000;
let alertEmailSuppressedUntil = 0;

const isMailQuotaError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /daily user sending limit exceeded|5\.4\.5|quota|sending limit/i.test(message);
};

const sendSlackNotification = async (webhookUrl: string, title: string, message: string, severity: string) => {
  try {
    const color = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#10b981';
    const payload = {
      attachments: [
        {
          color,
          title: `[${severity.toUpperCase()}] ${title}`,
          text: message,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logger.warn(`Failed to deliver Slack webhook notification: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const sendTelegramNotification = async (botToken: string, chatId: string, title: string, message: string, severity: string) => {
  try {
    const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : '✅';
    const text = `${emoji} *[${severity.toUpperCase()}] ${title}*\n\n${message}`;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (error) {
    logger.warn(`Failed to deliver Telegram notification: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const alertService = {
  async create(payload: CreateAlertPayload) {
    // 1. Fatigue Prevention & Deduplication (check unread in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const dedupeKey = payload.dedupeKey || String(payload.metadata?.dedupeKey || '');
    const existingAlert = await Alert.findOne({
      server: new Types.ObjectId(String(payload.serverId)),
      type: payload.type,
      read: false,
      created: { $gte: fifteenMinutesAgo },
      ...(dedupeKey ? { 'metadata.dedupeKey': dedupeKey } : {}),
    });

    if (existingAlert) {
      const metadata = existingAlert.metadata || {};
      const count = Number(metadata.occurrenceCount || 1) + 1;
      existingAlert.metadata = { ...metadata, occurrenceCount: count };
      existingAlert.created = new Date();
      existingAlert.message = `${payload.message} (Occurred ${count} times)`;
      await existingAlert.save();

      socketService.emitToServer(String(payload.serverId), 'alert:created', existingAlert);
      return existingAlert;
    }

    const alert = await Alert.create({
      server: new Types.ObjectId(String(payload.serverId)),
      type: payload.type,
      severity: payload.severity,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata || {},
      read: false,
      created: new Date(),
    });

    socketService.emitToServer(String(payload.serverId), 'alert:created', alert);

    // Fetch config for Slack & Telegram notifications
    const serverConfig = await ServerMaintenanceConfig.findOne({ server: new Types.ObjectId(String(payload.serverId)) });

    if (serverConfig) {
      if (serverConfig.slackWebhookUrl) {
        void sendSlackNotification(serverConfig.slackWebhookUrl, payload.title, payload.message, payload.severity);
      }
      if (serverConfig.telegramBotToken && serverConfig.telegramChatId) {
        void sendTelegramNotification(
          serverConfig.telegramBotToken,
          serverConfig.telegramChatId,
          payload.title,
          payload.message,
          payload.severity
        );
      }
    }

    if (payload.email !== false && Date.now() < alertEmailSuppressedUntil) {
      logger.warn('Alert email skipped because SMTP sending is temporarily suppressed after a previous quota/limit failure.');
    } else if (payload.email !== false) {
      const server = await ServerConnection.findById(payload.serverId);
      if (server?.email) {
        try {
          await sendMail({
            to: server.email,
            subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
            html: buildEmailHtml(payload.title, payload.message, payload.metadata || {}),
            text: `${payload.title}\n\n${payload.message}`,
          });
          alert.emailedAt = new Date();
          await alert.save();
        } catch (error) {
          if (isMailQuotaError(error)) {
            alertEmailSuppressedUntil = Date.now() + MAIL_SUPPRESSION_MS;
          }
          logger.warn(`Alert email failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return alert;
  },

  async list(serverId?: string, limit = 20) {
    const query = serverId ? { server: new Types.ObjectId(serverId) } : {};
    return Alert.find(query).sort({ created: -1 }).limit(limit);
  },
};
