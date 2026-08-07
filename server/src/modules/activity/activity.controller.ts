import { Request, Response } from 'express';
import { activityService } from './activity.service';
import { Activity } from './activity.model';
import serviceUtil from '../../utils/service.util';

export const activityController = {
  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, "View", "activities");
    const query = await serviceUtil.generateListQuery(req, "Activities");
    
    // Custom filter for my activities if not admin? 
    // The legacy code had: query.filter = { type: 'user', active: true, 'createdBy.user': user._id };
    // But usually an Activity log is for admins to see everyone.
    
    const result = await activityService.getActivities(query);
    
    return res.json({
      activities: result.details,
      pagination: result.pagination
    });
  },

  async getMyActivities(req: Request, res: Response) {
    const query = await serviceUtil.generateListQuery(req, "Activities");
    query.filter.user = (req as any).user._id;
    
    const result = await activityService.getActivities(query);
    
    return res.json({
      activities: result.details,
      pagination: result.pagination
    });
  }
};
