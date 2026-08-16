import { Request, Response } from 'express';
import { accommodationService } from './accommodation.service';
import { AccommodationRoomType } from './accommodation.model';
import respUtil from '../../utils/resp.util';
import serviceUtil from '../../utils/service.util';
import { resolveBooker } from '../../utils/guestCheckout.util';

export const accommodationController = {
  async listRoomTypes(req: Request, res: Response) {
    const roomTypes = await accommodationService.listRoomTypes();
    req.entityType = 'roomTypes';
    req.roomTypes = roomTypes;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async createRoomType(req: Request, res: Response) {
    const roomType = await accommodationService.createRoomType(req.body);

    req.entityType = 'accommodationRoomType';
    req.accommodationRoomType = roomType;
    await serviceUtil.addActivity(
      req,
      'AccommodationRoomType',
      'Create',
      `Created room type: ${roomType.name}`,
      'accommodationRoomTypeCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async updateRoomType(req: Request, res: Response) {
    const oldRoomType = await AccommodationRoomType.findById(req.params.id);
    const roomType = await accommodationService.updateRoomType(req.params.id, req.body, req.locale || 'en');

    req.entityType = 'accommodationRoomType';
    req.accommodationRoomType = roomType;
    await serviceUtil.logUpdateActivity(req, oldRoomType, roomType, 'AccommodationRoomType', 'accommodationRoomTypeUpdate', 'name');

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async deleteRoomType(req: Request, res: Response) {
    const roomTypeToDelete = await AccommodationRoomType.findById(req.params.id);
    await accommodationService.deleteRoomType(req.params.id, req.locale || 'en');

    req.entityType = 'accommodationRoomType';
    req.accommodationRoomType = { _id: req.params.id };

    if (roomTypeToDelete) {
      await serviceUtil.addActivity(
        req,
        'AccommodationRoomType',
        'Delete',
        `Deleted room type: ${roomTypeToDelete.name}`,
        'accommodationRoomTypeDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async createBooking(req: Request, res: Response) {
    const booker = resolveBooker(req, req.body, req.locale || 'en');
    const booking = await accommodationService.createBooking(booker, req.body, req.locale || 'en');

    req.entityType = 'accommodationBooking';
    req.accommodationBooking = booking;

    return res.json(respUtil.createSuccessResponse(req));
  },
};
