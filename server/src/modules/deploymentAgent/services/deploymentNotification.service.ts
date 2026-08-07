import { Types } from 'mongoose';
import { Application } from '../models/application.model';
import { Deployment } from '../models/deployment.model';
import { DeploymentEmailLog } from '../models/deploymentEmailLog.model';
import { User } from '../../user/user.model';
import { sendMail } from '../../../utils/mail.util';
import { logger } from '../../../utils/logger.util';

export interface NotificationExtraInfo {
  failedStep?: string;
  errorMessage?: string;
  rollbackReason?: string;
  previousReleaseDir?: string;
}

function formatDuration(ms?: number): string {
  if (!ms) return '0 seconds';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
  }
  return `${secs} second${secs !== 1 ? 's' : ''}`;
}

function isValidUrl(urlStr?: string): boolean {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    if (url.hostname === 'none' || url.hostname === 'undefined' || url.hostname === 'null') {
      return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

export const deploymentNotificationService = {
  async sendNotification(
    eventType: 'deployment_started' | 'deployment_success' | 'deployment_failed' | 'deployment_rollback',
    deploymentId: string | Types.ObjectId,
    extraInfo?: NotificationExtraInfo
  ): Promise<void> {
    try {
      // 1. Fetch deployment with application and target details
      const deployment = await Deployment.findById(deploymentId)
        .populate('applicationId')
        .populate('targetId');

      if (!deployment) {
        logger.warn(`[Notification] Deployment ${deploymentId} not found, skipping notifications.`);
        return;
      }

      const application = deployment.applicationId as any;
      const target = deployment.targetId as any;

      if (!application) {
        logger.warn(`[Notification] Application not associated with deployment ${deploymentId}, skipping.`);
        return;
      }

      // 2. Load and verify notification settings
      const settings = application.notificationSettings;
      let isEnabled = true;

      if (settings) {
        if (eventType === 'deployment_started') isEnabled = settings.notifyOnStart;
        else if (eventType === 'deployment_success') isEnabled = settings.notifyOnSuccess;
        else if (eventType === 'deployment_failed') isEnabled = settings.notifyOnFailure;
        else if (eventType === 'deployment_rollback') isEnabled = settings.notifyOnRollback;
      }

      if (!isEnabled) {
        logger.info(`[Notification] Event type ${eventType} is disabled in application notification settings.`);
        return;
      }

      // 3. Resolve recipients (Owner Email + Additional Emails + Alert Email)
      const recipients: string[] = [];
      
      // Load owner email
      if (application.owner) {
        const ownerUser = await User.findById(application.owner).lean();
        if (ownerUser?.email) {
          recipients.push(ownerUser.email);
        }
      }

      if (application.alertEmail) {
        recipients.push(application.alertEmail);
      }

      if (settings?.additionalRecipients?.length) {
        recipients.push(...settings.additionalRecipients);
      }

      const toList = Array.from(new Set(recipients.filter(Boolean)));
      if (toList.length === 0) {
        logger.info(`[Notification] No recipients resolved for event ${eventType} on deployment ${deploymentId}.`);
        return;
      }

      // 4. Resolve Triggered By Name
      let triggeredByName = 'System/Webhook';
      if (deployment.triggeredBy) {
        const user = await User.findById(deployment.triggeredBy).lean();
        if (user) {
          triggeredByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
        }
      }

      // 5. Build urls
      let appUrl = '';
      if (application.components && application.components.length > 0) {
        const comp = application.components[0];
        if (comp.healthCheckUrl) {
          appUrl = comp.healthCheckUrl;
        } else if (comp.port && target?.host) {
          appUrl = `http://${target.host}:${comp.port}`;
        }
      }
      if (!appUrl && target?.host && target.host !== 'none') {
        appUrl = `http://${target.host}`;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const logsUrl = `${frontendUrl}/deployment/deployments?id=${deployment._id}`;

      const showAppUrl = isValidUrl(appUrl);
      const showLogsUrl = isValidUrl(logsUrl);

      // 6. Build Content and Subject
      let subject = '';
      let html = '';
      let text = '';

      const appName = application.displayName || application.name;
      const environment = deployment.branch || 'production';
      const branch = deployment.branch || 'main';
      const version = deployment.commitSha?.slice(0, 8) || String(deployment._id).slice(-8);

      const headerStyle = 'padding:24px;border-top-left-radius:12px;border-top-right-radius:12px;color:#ffffff;';
      const tableStyle = 'width:100%;border-collapse:collapse;margin:20px 0;';
      const tdLabelStyle = 'padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;';
      const tdValStyle = 'padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;';

      if (eventType === 'deployment_started') {
        subject = `🚀 Deployment Started - ${appName}`;
        text = `Your deployment has started successfully.\n\nApplication: ${appName}\nEnvironment: ${environment}\nBranch: ${branch}\nVersion: ${version}\nDeployment ID: ${deployment._id}\nTriggered By: ${triggeredByName}\nStarted At: ${new Date(deployment.startedAt || deployment.created).toLocaleString()}\n\nYou will receive another notification once deployment completes.`;
        html = `
          <table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #e5e7eb;border-radius:12px;background-color:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);border-collapse:separate;overflow:hidden;">
            <tr>
              <td style="padding:24px;background-color:#4f46e5;color:#ffffff;border-top-left-radius:11px;border-top-right-radius:11px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="font-size:20px;font-weight:bold;color:#ffffff;line-height:1.2;">
                      🚀 Deployment Started
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#ffffff;opacity:0.9;padding-top:4px;line-height:1.4;">
                      Initiating pipeline execution for ${appName}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;background-color:#ffffff;">
                <p style="margin-top:0;font-size:15px;color:#374151;line-height:1.5;">Your deployment has started successfully.</p>
                <table style="${tableStyle}">
                  <tr>
                    <td style="${tdLabelStyle}">Application</td>
                    <td style="${tdValStyle}"><strong>${appName}</strong></td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Environment</td>
                    <td style="${tdValStyle}">${environment}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Branch</td>
                    <td style="${tdValStyle}">${branch}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Version</td>
                    <td style="${tdValStyle}"><code>${version}</code></td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Deployment ID</td>
                    <td style="${tdValStyle}">${deployment._id}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Triggered By</td>
                    <td style="${tdValStyle}">${triggeredByName}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Started At</td>
                    <td style="${tdValStyle}">${new Date(deployment.startedAt || deployment.created).toLocaleString()}</td>
                  </tr>
                </table>
                ${showLogsUrl ? `
                <div style="margin-top:24px;text-align:center;">
                  <a href="${logsUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;box-shadow:0 2px 4px rgba(79,70,229,0.2);">View Execution Logs</a>
                </div>
                ` : ''}
                <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;text-align:center;">You will receive another notification once deployment completes.</p>
              </td>
            </tr>
          </table>
        `;
      } else if (eventType === 'deployment_success') {
        subject = `✅ Deployment Successful - ${appName}`;
        text = `Deployment completed successfully.\n\nApplication: ${appName}\nEnvironment: ${environment}\nBranch: ${branch}\nVersion: ${version}\nDeployment ID: ${deployment._id}\nServer: ${target?.name || 'none'}\nDuration: ${formatDuration(deployment.durationMs)}\nTriggered By: ${triggeredByName}\nCompleted At: ${new Date(deployment.completedAt || new Date()).toLocaleString()}\n\nApplication URL: ${appUrl}\nDeployment Logs: ${logsUrl}`;
        html = `
          <table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #e5e7eb;border-radius:12px;background-color:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);border-collapse:separate;overflow:hidden;">
            <tr>
              <td style="padding:24px;background-color:#10b981;color:#ffffff;border-top-left-radius:11px;border-top-right-radius:11px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="font-size:20px;font-weight:bold;color:#ffffff;line-height:1.2;">
                      ✅ Deployment Successful
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#ffffff;opacity:0.9;padding-top:4px;line-height:1.4;">
                      Application is now live and healthy
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;background-color:#ffffff;">
                <p style="margin-top:0;font-size:15px;color:#374151;line-height:1.5;">Deployment completed successfully.</p>
                <table style="${tableStyle}">
                  <tr>
                    <td style="${tdLabelStyle}">Application</td>
                    <td style="${tdValStyle}"><strong>${appName}</strong></td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Environment</td>
                    <td style="${tdValStyle}">${environment}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Version</td>
                    <td style="${tdValStyle}"><code>${version}</code></td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Server</td>
                    <td style="${tdValStyle}">${target?.name || 'none'} (${target?.host || 'none'})</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Duration</td>
                    <td style="${tdValStyle}">${formatDuration(deployment.durationMs)}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Triggered By</td>
                    <td style="${tdValStyle}">${triggeredByName}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Completed At</td>
                    <td style="${tdValStyle}">${new Date(deployment.completedAt || new Date()).toLocaleString()}</td>
                  </tr>
                </table>
                <div style="margin-top:24px;text-align:center;">
                  ${showAppUrl ? `<a href="${appUrl}" style="display:inline-block;padding:10px 20px;background-color:#10b981;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;margin:6px 12px;box-shadow:0 2px 4px rgba(16,185,129,0.2);">Open Live App</a>` : ''}
                  ${showLogsUrl ? `<a href="${logsUrl}" style="display:inline-block;padding:10px 20px;background-color:#f3f4f6;color:#374151;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;border:1px solid #e5e7eb;margin:6px 12px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">View Logs</a>` : ''}
                </div>
              </td>
            </tr>
          </table>
        `;
      } else if (eventType === 'deployment_failed') {
        const failedStep = extraInfo?.failedStep || deployment.steps?.find((s) => s.status === 'failed')?.stepName || 'Pipeline Execution';
        const errMsg = extraInfo?.errorMessage || deployment.error || 'Unknown Pipeline error occurred.';

        subject = `❌ Deployment Failed - ${appName}`;
        text = `Deployment failed during build execution.\n\nApplication: ${appName}\nEnvironment: ${environment}\nBranch: ${branch}\nVersion: ${version}\nDeployment ID: ${deployment._id}\nFailed Step: ${failedStep}\nServer: ${target?.name || 'none'}\nTriggered By: ${triggeredByName}\nFailure Time: ${new Date().toLocaleString()}\n\nError: ${errMsg}\n\nReview deployment logs: ${logsUrl}`;
        html = `
          <table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #e5e7eb;border-radius:12px;background-color:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);border-collapse:separate;overflow:hidden;">
            <tr>
              <td style="padding:24px;background-color:#ef4444;color:#ffffff;border-top-left-radius:11px;border-top-right-radius:11px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="font-size:20px;font-weight:bold;color:#ffffff;line-height:1.2;">
                      ❌ Deployment Failed
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#ffffff;opacity:0.9;padding-top:4px;line-height:1.4;">
                      Pipeline halted at step: ${failedStep}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;background-color:#ffffff;">
                <p style="margin-top:0;font-size:15px;color:#374151;line-height:1.5;">Deployment failed during execution.</p>
                
                <div style="background-color:#fef2f2;border:1px solid #fca5a5;padding:16px;border-radius:8px;margin-bottom:20px;">
                  <h4 style="margin:0 0 8px 0;color:#991b1b;font-size:14px;font-weight:700;">Prominent Failure Reason:</h4>
                  <p style="margin:0 0 4px 0;font-size:13px;color:#7f1d1d;"><strong>Failed Step:</strong> ${failedStep}</p>
                  <pre style="margin:8px 0 0 0;background-color:#ffffff;border:1px solid #fee2e2;padding:12px;border-radius:6px;font-family:monospace;font-size:12px;color:#991b1b;white-space:pre-wrap;overflow-x:auto;">${errMsg}</pre>
                </div>

                <table style="${tableStyle}">
                  <tr>
                    <td style="${tdLabelStyle}">Application</td>
                    <td style="${tdValStyle}"><strong>${appName}</strong></td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Environment</td>
                    <td style="${tdValStyle}">${environment}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Version</td>
                    <td style="${tdValStyle}"><code>${version}</code></td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Server</td>
                    <td style="${tdValStyle}">${target?.name || 'none'}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Triggered By</td>
                    <td style="${tdValStyle}">${triggeredByName}</td>
                  </tr>
                  <tr>
                    <td style="${tdLabelStyle}">Failure Time</td>
                    <td style="${tdValStyle}">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
                ${showLogsUrl ? `
                <div style="margin-top:24px;text-align:center;">
                  <a href="${logsUrl}" style="display:inline-block;padding:10px 20px;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;box-shadow:0 2px 4px rgba(220,38,38,0.2);">Review Deployment Logs</a>
                </div>
                ` : ''}
              </td>
            </tr>
          </table>
        `;
      } else if (eventType === 'deployment_rollback') {
        const rollbackReason = extraInfo?.rollbackReason || deployment.rollbackReason || 'Automatic rollback triggered due to pipeline step failure.';
        const targetVersion = extraInfo?.previousReleaseDir || deployment.previousReleaseDir || 'Previous stable release';

        subject = `⚠️ Rollback Executed - ${appName}`;
        text = `Rollback notification for application ${appName}.\n\nEnvironment: ${environment}\nCurrent Version: ${version}\nRolled Back To Version: ${targetVersion}\nReason: ${rollbackReason}\nTriggered By: ${triggeredByName}\nRollback Time: ${new Date().toLocaleString()}`;
        html = `
          <table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #e5e7eb;border-radius:12px;background-color:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);border-collapse:separate;overflow:hidden;">
            <tr>
              <td style="padding:24px;background-color:#d97706;color:#ffffff;border-top-left-radius:11px;border-top-right-radius:11px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="font-size:20px;font-weight:bold;color:#ffffff;line-height:1.2;">
                      ⚠️ Rollback Executed
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#ffffff;opacity:0.9;padding-top:4px;line-height:1.4;">
                      Reverted code and PM2 process state to last stable commit
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;background-color:#ffffff;">
                <p style="margin-top:0;font-size:15px;color:#374151;line-height:1.5;">A rollback has been executed for this application.</p>
                
                <div style="background-color:#fffbeb;border:1px solid #fde68a;padding:16px;border-radius:8px;margin-bottom:20px;">
                  <h4 style="margin:0 0 8px 0;color:#92400e;font-size:14px;font-weight:700;">Rollback Details:</h4>
                  <p style="margin:0;font-size:13px;color:#78350f;"><strong>Reason:</strong> ${rollbackReason}</p>
                </div>

                <table style="${tableStyle}">
                  <tr>
                    <td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">Application</td>
                    <td style="padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;"><strong>${appName}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">Environment</td>
                    <td style="padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;">${environment}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">Failed Version</td>
                    <td style="padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;"><code>${version}</code></td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">Rolled Back To</td>
                    <td style="padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;"><code>${targetVersion}</code></td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">Triggered By</td>
                    <td style="padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;">${triggeredByName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">Rollback Time</td>
                    <td style="padding:10px 12px;color:#1f2937;font-size:14px;border-bottom:1px solid #f3f4f6;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
                ${showLogsUrl ? `
                <div style="margin-top:24px;text-align:center;">
                  <a href="${logsUrl}" style="display:inline-block;padding:10px 20px;background-color:#d97706;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;box-shadow:0 2px 4px rgba(217,119,6,0.2);">View Action History</a>
                </div>
                ` : ''}
              </td>
            </tr>
          </table>
        `;
      }

      // 7. Send individual emails to each recipient & log outcomes
      for (const recipient of toList) {
        try {
          await sendMail({
            to: recipient,
            subject,
            html,
            text,
          });

          // Log successful notification
          await DeploymentEmailLog.create({
            deploymentId: deployment._id,
            eventType,
            recipient,
            subject,
            status: 'success',
            sentAt: new Date(),
          });
        } catch (mailErr: any) {
          logger.warn(`[Notification] Failed to send email to ${recipient}: ${mailErr?.message || String(mailErr)}`);
          
          // Log failed notification
          await DeploymentEmailLog.create({
            deploymentId: deployment._id,
            eventType,
            recipient,
            subject,
            status: 'failed',
            sentAt: new Date(),
            errorMessage: mailErr?.message || String(mailErr),
          });
        }
      }
    } catch (outerErr: any) {
      logger.error(`[Notification] Outer notification failure: ${outerErr?.message || String(outerErr)}`);
    }
  },
};
