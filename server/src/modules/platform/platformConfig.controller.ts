import { Request, Response } from 'express';
import * as platformConfigService from './platformConfig.service';
import { SocialPlatformConfig } from './platformConfig.model';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { maskSecret } from '../../utils/security.util';

export class PlatformConfigController {
  /**
   * Get all platform configurations
   */
  static getConfigs = asyncHandler(async (req: Request, res: Response) => {
    const configs = await platformConfigService.getAllPlatformConfigs();
    
    // Scrub secrets before sending to UI
    const safeConfigs = configs.map(c => ({
      ...c.toObject(),
      clientSecret: maskSecret(c.clientSecret) // It's still encrypted in DB, but mask it for UI
    }));

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: safeConfigs,
    });
  });

  /**
   * Update or create a platform configuration
   */
  static updateConfig = asyncHandler(async (req: Request, res: Response) => {
    const { platform, clientId, clientSecret, redirectUri } = req.body;

    if (!platform || !clientId || !clientSecret) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Platform, clientId, and clientSecret are required.',
      });
    }

    const config = await platformConfigService.updatePlatformConfig(platform, {
      clientId,
      clientSecret,
      redirectUri,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `${platform} configuration updated successfully.`,
      data: config,
    });
  });

  /**
   * Delete a platform configuration (revert to system .env defaults)
   */
  static deleteConfig = asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;

    if (!platform) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Platform is required.',
      });
    }

    await SocialPlatformConfig.findOneAndDelete({ platform: platform.toLowerCase() });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `${platform} configuration reset to system defaults.`,
    });
  });
}
