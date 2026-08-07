import nodemailer from 'nodemailer';
import { envConfig } from '../config/env.config';
import { logger } from './logger.util';

const transporter = nodemailer.createTransport({
  host: envConfig.mailHost,
  port: envConfig.mailPort,
  secure: envConfig.mailPort === 465,
  auth: {
    user: envConfig.mailUser,
    pass: envConfig.mailPass,
  },
});

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: any;
    contentType?: string;
    cid?: string;
  }>;
}

export const sendMail = async (options: MailOptions): Promise<void> => {
  try {
    const info = await transporter.sendMail({
      from: envConfig.mailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });
    logger.info(`Email accepted by SMTP for ${options.to}. Message ID: ${info.messageId}`);
  } catch (error: any) {
    logger.warn(`Email sending failed: ${error?.message || String(error)}`);
    throw error;
  }
};
