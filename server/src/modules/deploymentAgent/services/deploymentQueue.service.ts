// Per-application serial deploy queue with coalescing.
// While one deploy runs, at most ONE next deploy is held. A new webhook push
// replaces any existing queued entry (coalesce to newest), cancelling the
// superseded deployment record.
//
// Scale-out path: replace with a Redis/BullMQ-backed queue.

import { Deployment } from '../models/deployment.model';
import { IApplication } from '../models/application.model';
import { IDeploymentTarget } from '../models/deploymentTarget.model';

interface PendingEntry {
  deploymentId: string;
  application: IApplication;
  target: IDeploymentTarget;
  runFn: () => Promise<void>;
}

// appId → deploymentId of the currently executing pipeline
const activeRuns = new Map<string, string>();

// appId → single queued entry (newest wins via coalescing)
const pendingRuns = new Map<string, PendingEntry>();

// ─── Delivery-ID deduplication ────────────────────────────────────────────────
const MAX_DELIVERIES = 1000;
const processedDeliveries = new Set<string>();
const deliveryFifo: string[] = [];

export function trackDelivery(deliveryId: string): boolean {
  if (processedDeliveries.has(deliveryId)) return false;
  processedDeliveries.add(deliveryId);
  deliveryFifo.push(deliveryId);
  if (deliveryFifo.length > MAX_DELIVERIES) {
    const oldest = deliveryFifo.shift()!;
    processedDeliveries.delete(oldest);
  }
  return true;
}

// ─── Queue core ───────────────────────────────────────────────────────────────

async function startRun(appId: string, entry: PendingEntry): Promise<void> {
  activeRuns.set(appId, entry.deploymentId);
  // Use setImmediate so the HTTP response returns before the pipeline starts
  setImmediate(async () => {
    try {
      await entry.runFn();
    } catch {
      // Pipeline errors are persisted inside the pipeline; swallow here
    } finally {
      if (activeRuns.get(appId) === entry.deploymentId) {
        activeRuns.delete(appId);
      }
      // Dequeue the next pending run, if any
      const next = pendingRuns.get(appId);
      if (next) {
        pendingRuns.delete(appId);
        startRun(appId, next);
      }
    }
  });
}

export const deploymentQueueService = {
  isRunning(appId: string): boolean {
    return activeRuns.has(appId);
  },

  currentDeploymentId(appId: string): string | undefined {
    return activeRuns.get(appId);
  },

  async schedule(
    appId: string,
    deploymentId: string,
    application: IApplication,
    target: IDeploymentTarget,
    runFn: () => Promise<void>,
  ): Promise<void> {
    const entry: PendingEntry = { deploymentId, application, target, runFn };

    if (!activeRuns.has(appId)) {
      // Nothing running — start immediately
      startRun(appId, entry);
      return;
    }

    // Something already running: coalesce into the pending slot
    const existing = pendingRuns.get(appId);
    if (existing) {
      // Cancel the superseded queued deployment
      await Deployment.updateOne(
        { _id: existing.deploymentId, status: { $in: ['pending', 'running'] } },
        {
          status: 'cancelled',
          completedAt: new Date(),
          error: 'Superseded by a newer deployment pushed while this one was queued.',
          updated: new Date(),
        },
      );
    }

    pendingRuns.set(appId, entry);
  },
};
