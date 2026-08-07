import { Request, Response } from 'express';
import respUtil from '../../utils/resp.util';
import { tableViewService } from './tableView.service';

export const tableViewController = {
  async getPreference(req: Request, res: Response) {
    const currentUser = req.user as { _id?: string } | undefined;
    const preference = await tableViewService.getByUserAndTable(
      String(currentUser?._id || ''),
      req.params.tableId,
    );

    return res.json(respUtil.dataSuccessResponse(req, preference));
  },

  async updatePreference(req: Request, res: Response) {
    const currentUser = req.user as { _id?: string } | undefined;
    const preference = await tableViewService.upsertByUserAndTable(
      String(currentUser?._id || ''),
      req.params.tableId,
      req.body,
    );

    return res.json(
      respUtil.dataSuccessResponse(req, preference, 'Table view preference saved successfully.'),
    );
  },
};
