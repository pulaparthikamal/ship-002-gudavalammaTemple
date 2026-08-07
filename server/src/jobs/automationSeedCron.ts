import cron from 'node-cron';
import { Automation, IAutomation } from '../modules/social-automation/automation.model';
import { Post } from '../modules/posts/post.model';
import { ContentNoveltyItem, generatePostContent } from '../services/ai-social.service';
import { getTopicNoveltyHistory } from '../services/content-novelty.service';
import { createApprovalToken, sendSocialApprovalEmail } from '../services/social-approval.service';
import { logger } from '../utils/logger.util';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Posts are seeded this many hours before their scheduled posting time. */
const SEED_LEAD_HOURS = 12;

/** Retry attempts for AI content generation (Fix #10). */
const MAX_GENERATION_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseTime(timeStr: string): [number, number] {
  const parts = (timeStr || '10:00').split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return [isNaN(h) ? 10 : h, isNaN(m) ? 0 : m];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE HANDLING — Industry-standard UTC-everywhere approach
// ─────────────────────────────────────────────────────────────────────────────
//
// The user configures automation times as wall-clock IST (e.g. "07:00").
// The server may run in any timezone (UTC in production).
//
// Rule: ALL dates stored in DB and compared in code MUST be UTC.
// We interpret the user's HH:MM as IST and convert to UTC at slot creation time.
//
// IST = UTC + 5h 30m = UTC + 19800 seconds
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000 ms

/**
 * Given a UTC Date representing any moment within a calendar day (in IST),
 * returns the UTC Date corresponding to midnight of that same IST calendar day.
 *
 * Example: new Date('2026-06-07T00:00:00Z') is 5:30 AM IST on June 7.
 *          istMidnightUTC('2026-06-07T00:00:00Z') = '2026-06-06T18:30:00Z'
 *          (because IST June 7 midnight = UTC June 6 18:30)
 */
function istMidnightUTC(utcMoment: Date): Date {
  // Shift to IST, zero out the time, shift back to UTC
  const istMs = utcMoment.getTime() + IST_OFFSET_MS;
  const istMidnightMs = istMs - (istMs % (24 * 60 * 60 * 1000));
  return new Date(istMidnightMs - IST_OFFSET_MS);
}

/**
 * Advance a "IST midnight" UTC Date by exactly one IST calendar day (24 h).
 */
function nextISTDay(istMidnightUTCDate: Date): Date {
  return new Date(istMidnightUTCDate.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Build a UTC Date for the given IST calendar day at the given IST wall-clock time.
 *
 * Example: slotAtIST(istMidnightOf_June7, 7, 0)
 *          → '2026-06-07T01:30:00.000Z'  (7:00 AM IST = 1:30 AM UTC)
 */
function slotAtIST(istMidnightUTCDate: Date, hours: number, minutes: number): Date {
  return new Date(istMidnightUTCDate.getTime() + (hours * 60 + minutes) * 60 * 1000);
}

/**
 * Returns the IST day-of-week index (0=Sun … 6=Sat) for a UTC Date.
 * Needed because JavaScript's .getDay() uses the server's local timezone.
 */
function istDayOfWeek(utcDate: Date): number {
  const istDate = new Date(utcDate.getTime() + IST_OFFSET_MS);
  return istDate.getUTCDay();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix #6: slot computation filters out slots that exceed endDate
// ─────────────────────────────────────────────────────────────────────────────

function computeSlotsInWindow(
  automation: IAutomation,
  windowStart: Date,
  windowEnd: Date,
): Date[] {
  const slots: Date[] = [];

  const campaignEnd = automation.endDate ? new Date(automation.endDate) : null;

  const addSlot = (slot: Date) => {
    if (slot >= windowStart && slot <= windowEnd) {
      if (!campaignEnd || slot <= campaignEnd) {
        slots.push(new Date(slot));
      }
    }
  };

  switch (automation.frequency) {
    case 'daily': {
      const [h, m] = parseTime(automation.time);
      // Start from the IST calendar day that contains windowStart
      let day = istMidnightUTC(windowStart);
      while (day <= windowEnd) {
        addSlot(slotAtIST(day, h, m));
        day = nextISTDay(day);
      }
      break;
    }

    case 'weekly': {
      const [h, m] = parseTime(automation.time);
      const targetDow = automation.startDate
        ? istDayOfWeek(new Date(automation.startDate))
        : istDayOfWeek(new Date());
      let day = istMidnightUTC(windowStart);
      while (day <= windowEnd) {
        if (istDayOfWeek(day) === targetDow) {
          addSlot(slotAtIST(day, h, m));
        }
        day = nextISTDay(day);
      }
      break;
    }

    case 'custom': {
      if (!automation.customDays?.length) break;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const [h, m] = parseTime(automation.time);
      let day = istMidnightUTC(windowStart);
      while (day <= windowEnd) {
        if (automation.customDays.includes(dayNames[istDayOfWeek(day)])) {
          addSlot(slotAtIST(day, h, m));
        }
        day = nextISTDay(day);
      }
      break;
    }

    case 'fixed': {
      if (!automation.fixedDate) break;
      const [h, m] = parseTime(automation.time);
      // fixedDate is a date string — interpret its calendar day in IST
      const fixedDay = istMidnightUTC(new Date(automation.fixedDate));
      addSlot(slotAtIST(fixedDay, h, m));
      break;
    }

    default:
      break;
  }

  return slots;
}


// ─────────────────────────────────────────────────────────────────────────────
// Fix #10: retry AI content generation up to MAX_GENERATION_RETRIES times
// ─────────────────────────────────────────────────────────────────────────────

async function generateWithRetry(
  category: string,
  interests: string[],
  tone: string,
  targetAudience?: string,
  noveltyHistory: ContentNoveltyItem[] = [],
) {
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_GENERATION_RETRIES; attempt++) {
    try {
      const result = await generatePostContent(category, interests, tone, targetAudience, { noveltyHistory });
      return result;
    } catch (err: any) {
      lastError = err;
      logger.warn(`[AutomationSeedCron] AI generation attempt ${attempt}/${MAX_GENERATION_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_GENERATION_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
const activeSeedingSlots = new Set<string>();

function isDuplicateKeyError(error: any) {
  return error?.code === 11000;
}

// Core seed function — seeds posts for one automation in a given window
// ─────────────────────────────────────────────────────────────────────────────

export async function seedPostsForAutomation(
  automation: IAutomation,
  postingWindowStart: Date,
  postingWindowEnd: Date,
): Promise<number> {
  const category = (automation.categoryId as any)?.name || 'General';
  const topic = automation.interests?.[0] || category;

  // Fix #1: use per-automation approvalEmail, fall back to env SOCIAL_APPROVAL_EMAIL
  const approvalEmail = automation.approvalEmail || undefined;

  const slots = computeSlotsInWindow(automation, postingWindowStart, postingWindowEnd);
  if (!slots.length) return 0;

  logger.info(`[AutomationSeedCron] Automation ${automation._id}: ${slots.length} slot(s) to seed`);

  let seeded = 0;

  for (const slot of slots) {
    const scheduledStr = slot.toISOString();
    const lockKey = `${automation._id}_${scheduledStr}`;

    // Race condition prevention lock guard
    if (activeSeedingSlots.has(lockKey)) {
      logger.info(`[AutomationSeedCron] Slot ${scheduledStr} is already actively generating content. Skipping duplicate trigger.`);
      continue;
    }

    // Acquire lock
    activeSeedingSlots.add(lockKey);

    try {
      const approvalToken = createApprovalToken();
      let reservedPostId: any;

      try {
        const reservation = await Post.updateOne(
          { automationId: automation._id, scheduledAt: scheduledStr },
          {
            $setOnInsert: {
              userId: automation.userId,
              automationId: automation._id,
              postType: 'ai',
              postingMode: 'schedule',
              sourceTopic: topic,
              topic,
              targetAudience: automation.targetAudience,
              content: '',
              mediaUrls: [],
              platforms: automation.platforms,
              tone: automation.tone,
              status: 'waiting_for_approval',
              approvalStatus: 'content_generation_pending',
              approvalToken,
              scheduledAt: scheduledStr,
              approvedByEmail: approvalEmail || undefined,
            },
          },
          { upsert: true },
        );

        if (!reservation.upsertedCount) {
          const existing = await Post.findOne({ automationId: automation._id, scheduledAt: scheduledStr });
          if (existing?.approvalStatus === 'content_generation_pending' && existing.approvalToken && existing.approvalRequestedAt && existing.content?.trim()) {
            logger.warn(`[AutomationSeedCron] Post ${existing._id} was seeded but email never sent — resending`);
            try {
              await sendSocialApprovalEmail(existing, approvalEmail);
              await Post.findByIdAndUpdate(existing._id, { approvalStatus: 'email_sent' });
              seeded++;
            } catch (mailErr: any) {
              logger.error(`[AutomationSeedCron] Resend email failed for ${existing._id}: ${mailErr.message}`);
              await Post.findByIdAndUpdate(existing._id, { approvalStatus: 'email_failed' });
            }
          } else {
            logger.info(`[AutomationSeedCron] Slot ${scheduledStr} already seeded or reserved, skipping`);
          }
          continue;
        }

        reservedPostId = reservation.upsertedId;
      } catch (reservationErr: any) {
        if (isDuplicateKeyError(reservationErr)) {
          logger.info(`[AutomationSeedCron] Slot ${scheduledStr} was claimed by another worker, skipping`);
          continue;
        }
        throw reservationErr;
      }

      logger.info(`[AutomationSeedCron] Generating AI content for slot ${scheduledStr}...`);
      const noveltyHistory = await getTopicNoveltyHistory({
        topic,
        userId: automation.userId,
        targetAudience: automation.targetAudience,
      });

      // Fix #10: retry on failure
      const generated = await generateWithRetry(
        category,
        automation.interests || [],
        automation.tone || 'humanic',
        automation.targetAudience,
        noveltyHistory,
      );

      const post = await Post.findByIdAndUpdate(
        reservedPostId,
        {
          $set: {
            title: generated.title,
            sourceTopic: topic,
            topic,
            targetAudience: automation.targetAudience,
            content: (generated as any).content || generated.caption || '',
            mediaUrl: generated.mediaUrl,
            mediaUrls: generated.mediaUrls || [],
            platformSpecificContent: generated.platformSpecificContent,
            additionalInformation: generated.additionalInformation,
            generationBrief: generated.generationBrief,
            instagramHtml: generated.instagramHtml,
            approvalRequestedAt: new Date(),
            approvedByEmail: approvalEmail || undefined,
          },
        },
        { new: true },
      );

      if (!post) {
        throw new Error(`Reserved post ${String(reservedPostId)} was not found during finalization.`);
      }

      // Fix #1: pass automation-level approvalEmail override to email sender
      try {
        await sendSocialApprovalEmail(post, approvalEmail);
        await Post.findByIdAndUpdate(post._id, { approvalStatus: 'email_sent' });
        logger.info(`[AutomationSeedCron] ✓ Post ${post._id} created & email sent for slot ${scheduledStr}`);
      } catch (mailErr: any) {
        logger.error(`[AutomationSeedCron] ✗ Email sending failed for post ${post._id}: ${mailErr.message}`);
        await Post.findByIdAndUpdate(post._id, { approvalStatus: 'email_failed' });
      }
      seeded++;
    } catch (err: any) {
      logger.error(`[AutomationSeedCron] ✗ Failed slot ${scheduledStr}: ${err.message}`);
      await Post.findOneAndDelete({
        automationId: automation._id,
        scheduledAt: scheduledStr,
        approvalStatus: 'content_generation_pending',
        approvalRequestedAt: { $exists: false },
      });
    } finally {
      // Release lock
      activeSeedingSlots.delete(lockKey);
    }
  }

  return seeded;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix #3: catch-up function — called on server startup to recover missed slots
// ─────────────────────────────────────────────────────────────────────────────

export const runSeedCatchUp = async () => {
  logger.info('[AutomationSeedCron] Running startup catch-up for missed slots...');

  const now = new Date();

  // Look back up to SEED_LEAD_HOURS to catch any missed windows
  // e.g. if SEED_LEAD_HOURS=12 and server was down 2h, we cover a 2h missed window
  const catchUpStart = new Date(now.getTime() - SEED_LEAD_HOURS * 60 * 60 * 1000);
  const catchUpEnd   = new Date(now.getTime() + (SEED_LEAD_HOURS + 1) * 60 * 60 * 1000);

  // Look back 2 hours to catch any immediate/recent slots and up to 13 hours ahead
  const postingWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const postingWindowEnd   = catchUpEnd;              // up to 13h from now

  logger.info(`[AutomationSeedCron] Catch-up posting window: ${postingWindowStart.toISOString()} → ${postingWindowEnd.toISOString()}`);

  const automations = await Automation.find({ isActive: true, isDeleted: false }).populate('categoryId');
  const relevant = automations.filter((a) => {
    if (a.startDate && new Date(a.startDate) > postingWindowEnd) return false;
    if (a.endDate && new Date(a.endDate) < now) return false;
    return true;
  });

  let total = 0;
  for (const automation of relevant) {
    const count = await seedPostsForAutomation(automation, postingWindowStart, postingWindowEnd);
    total += count;
  }

  logger.info(`[AutomationSeedCron] Catch-up complete — seeded ${total} post(s)`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Cron entry point
// ─────────────────────────────────────────────────────────────────────────────

export const startAutomationSeedCron = () => {
  /**
   * Runs every hour at the top of the hour: '0 * * * *'
   * Looks at posting slots exactly 12h from now.
   *
   * Override with AUTOMATION_SEED_CRON_SCHEDULE in .env for testing:
   *   '* * * * *'  → runs every minute
   */
  const schedule = process.env.AUTOMATION_SEED_CRON_SCHEDULE || '0 * * * *';

  logger.info(`[AutomationSeedCron] Starting — schedule: "${schedule}", lead: ${SEED_LEAD_HOURS}h`);

  cron.schedule(schedule, async () => {
    logger.info('[AutomationSeedCron] Tick — seeding posts 12h ahead...');

    try {
      const now = new Date();
      // Look from 2 hours in the past to catch immediate/recent slots up to 13 hours ahead
      const postingWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const postingWindowEnd   = new Date(now.getTime() + (SEED_LEAD_HOURS + 1) * 60 * 60 * 1000);

      logger.info(`[AutomationSeedCron] Posting window: ${postingWindowStart.toISOString()} → ${postingWindowEnd.toISOString()}`);

      const automations = await Automation.find({
        isActive: true,
        isDeleted: false,
      }).populate('categoryId');

      const relevant = automations.filter((a) => {
        if (a.startDate && new Date(a.startDate) > postingWindowEnd) return false;
        if (a.endDate && new Date(a.endDate) < postingWindowStart) return false;  // Fix #6: use postingWindowStart
        return true;
      });

      logger.info(`[AutomationSeedCron] ${relevant.length} automation(s) in range`);

      let totalSeeded = 0;
      for (const automation of relevant) {
        const count = await seedPostsForAutomation(automation, postingWindowStart, postingWindowEnd);
        totalSeeded += count;
      }

      logger.info(`[AutomationSeedCron] Done — seeded ${totalSeeded} post(s)`);
    } catch (err: any) {
      logger.error('[AutomationSeedCron] Unhandled error:', err.message);
    }
  });
};
