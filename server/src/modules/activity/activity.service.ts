import { Activity, IActivity } from './activity.model';
import { activityConfig } from '../../utils/activity.util';
import sessionUtil from '../../utils/session.util';
import requestIp from 'request-ip';

export const activityService = {
  /**
   * insert activity
   */
  async insertActivity(req: any) {
    try {
      const config = activityConfig[req.activityKey];
      if (!config) return true;

      const activityData: any = {
        ...config,
        created: new Date(),
      };

      // Set Context ID
      if (req.contextId) {
        activityData.contextId = req.contextId;
      } else if (req.entityType && req[req.entityType] && req[req.entityType]._id) {
        activityData.contextId = req[req.entityType]._id;
      }

      // Set Description
      if (req.description) {
        activityData.description = req.description;
      } else {
        activityData.description = config.desc;
      }

      // Set User Info
      const tokenInfo = sessionUtil.getTokenInfo(req);
      if (tokenInfo) {
        activityData.user = tokenInfo._id;
        activityData.userName = tokenInfo.firstName + ' ' + tokenInfo.lastName;
        activityData.email = tokenInfo.email;
        const roleName = typeof tokenInfo.role === 'object' ? (tokenInfo.role as any).role : 'USER';
        activityData.type = (roleName || 'USER').toUpperCase();
        
        activityData.ipAddress = tokenInfo.ipAddress || requestIp.getClientIp(req);
        activityData.browserName = tokenInfo.browserName;
        activityData.osName = tokenInfo.osName;
        activityData.osVersion = tokenInfo.osVersion;
        activityData.deviceType = tokenInfo.deviceType;
      }

      // Request JSON snapshot (Mask password)
      if (req.body && req.url) {
        const maskedBody = { ...req.body };
        if (maskedBody.password) maskedBody.password = '********';
        
        activityData.requestJson = {
          url: req.originalUrl || req.url,
          method: req.method,
          json: {
            body: maskedBody,
            params: req.query || {},
          },
        };
      }

      // Handle Login specifics
      if (req.activityKey === 'loginSuccess' && req.body && req.body.deviceInfo) {
        const deviceInfo = req.body.deviceInfo;
        activityData.browserName = deviceInfo.browserName;
        activityData.osName = deviceInfo.osName;
        activityData.osVersion = deviceInfo.osVersion;
        activityData.deviceType = deviceInfo.deviceType;
        activityData.ipAddress = deviceInfo.ipAddress || activityData.ipAddress;
      }

      await Activity.create(activityData);
      return true;
    } catch (error) {
      // Don't let activity logging crash the main request
      console.error('Activity logging failed:', error);
      return true;
    }
  },

  /**
   * get activities
   */
  async getActivities(query: any) {
    const data = await Activity.find(query.filter)
      .sort(query.sorting)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);
    
    const total = await Activity.countDocuments(query.filter);
    
    return {
      details: data,
      pagination: {
        ...query.pagination,
        totalCount: total
      }
    };
  }
};
