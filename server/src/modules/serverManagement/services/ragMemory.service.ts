import { MaintenanceLog } from '../models/maintenanceLog.model';
import { IScanResult } from '../models/scanResult.model';
import { logger } from '../../../utils/logger.util';

const chromaUrl = process.env.CHROMA_URL || process.env.CHROMA_BASE_URL;
const collectionName = process.env.CHROMA_COLLECTION || 'server_maintenance_memory';

const requestJson = async (path: string, init?: RequestInit) => {
  if (!chromaUrl) {
    return null;
  }

  const response = await fetch(`${chromaUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`ChromaDB request failed with ${response.status}`);
  }

  return response.json() as Promise<any>;
};

const bestEffortChromaAdd = async (id: string, document: string, metadata: Record<string, unknown>) => {
  if (!chromaUrl) {
    return;
  }

  try {
    const collection = await requestJson('/api/v1/collections', {
      method: 'POST',
      body: JSON.stringify({ name: collectionName, get_or_create: true }),
    });
    const collectionId = collection?.id || collectionName;

    await requestJson(`/api/v1/collections/${collectionId}/add`, {
      method: 'POST',
      body: JSON.stringify({
        ids: [id],
        documents: [document],
        metadatas: [metadata],
      }),
    });
  } catch (error) {
    logger.warn('ChromaDB memory write skipped', error);
  }
};

export const ragMemoryService = {
  async getHistoricalPatterns(scanResult: IScanResult) {
    const fileName = scanResult.fileName;
    const extension = fileName.includes('.') ? fileName.split('.').pop() : undefined;
    const query: Record<string, unknown> = {
      server: scanResult.server,
      action: { $in: ['delete', 'archive', 'ignore'] },
      status: 'success',
    };

    if (extension) {
      query['metadata.extension'] = extension;
    }

    const logs = await MaintenanceLog.find(query).sort({ created: -1 }).limit(5);
    return logs.map((log) => ({
      action: log.action,
      reason: log.reason,
      created: log.created,
      path: log.metadata.path,
    }));
  },

  async rememberAction(payload: {
    id: string;
    scanResult?: IScanResult;
    action: string;
    reason: string;
    status: string;
  }) {
    if (!payload.scanResult) {
      return;
    }

    const extension = payload.scanResult.fileName.includes('.')
      ? payload.scanResult.fileName.split('.').pop()
      : undefined;

    await bestEffortChromaAdd(
      payload.id,
      [
        `action=${payload.action}`,
        `status=${payload.status}`,
        `category=${payload.scanResult.category}`,
        `path=${payload.scanResult.path}`,
        `reason=${payload.reason}`,
      ].join('\n'),
      {
        serverId: String(payload.scanResult.server),
        category: payload.scanResult.category,
        action: payload.action,
        status: payload.status,
        extension,
      }
    );
  },
};
