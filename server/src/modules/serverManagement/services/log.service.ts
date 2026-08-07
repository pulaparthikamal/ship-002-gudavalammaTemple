import { Types } from 'mongoose';
import { MaintenanceLog } from '../models/maintenanceLog.model';

interface ListLogParams {
  serverId?: string;
  page: number;
  limit: number;
  sortfield: string;
  direction: string;
  criteria: any[];
}

export const logService = {
  async list({ serverId, page, limit, sortfield, direction, criteria }: ListLogParams) {
    const query: any = {};
    if (serverId) {
      query.server = new Types.ObjectId(serverId);
    }

    if (criteria && Array.isArray(criteria)) {
      criteria.forEach(c => {
        if (c.key && c.value !== undefined) {
          if (c.type === 'equals') query[c.key] = c.value;
          else if (c.type === 'contains') query[c.key] = { $regex: c.value, $options: 'i' };
          else if (c.type === 'in' && Array.isArray(c.value)) query[c.key] = { $in: c.value };
          else query[c.key] = c.value; // default fallback
        }
      });
    }

    const sortOrder = direction === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const [rawLogs, total] = await Promise.all([
      MaintenanceLog.find(query)
        .sort({ [sortfield]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('server', 'name host port username')
        .lean(),
      MaintenanceLog.countDocuments(query)
    ]);

    const logs = rawLogs.map((log: any) => {
      const serverData = log.server;
      return {
        ...log,
        server: serverData?._id ? serverData._id.toString() : serverData,
        name: serverData?.name,
        host: serverData?.host,
        port: serverData?.port,
        username: serverData?.username
      };
    });

    return { logs, total };
  },
};
