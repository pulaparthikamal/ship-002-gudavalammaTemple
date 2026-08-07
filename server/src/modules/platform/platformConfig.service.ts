import { SocialPlatformConfig } from './platformConfig.model';
import { envConfig } from '../../config/env.config';
import { encrypt, decrypt } from '../../utils/security.util';

export const getPlatformConfig = async (platform: string) => {
  const config = await SocialPlatformConfig.findOne({ platform: platform.toLowerCase(), isActive: true });
  
  if (config) {
    return {
      clientId: config.clientId,
      clientSecret: decrypt(config.clientSecret),
      redirectUri: config.redirectUri,
    };
  }

  // Fallback to env variables if not found in DB
  switch (platform.toLowerCase()) {
    case 'facebook':
      return {
        clientId: envConfig.fbAppId,
        clientSecret: envConfig.fbAppSecret,
        redirectUri: envConfig.fbRedirectUri,
      };
    case 'instagram':
      return {
        clientId: envConfig.instagramAppId || envConfig.fbAppId,
        clientSecret: envConfig.instagramAppSecret || envConfig.fbAppSecret,
        redirectUri: envConfig.instagramRedirectUri || envConfig.fbRedirectUri,
      };
    case 'linkedin':
      return {
        clientId: envConfig.linkedInClientId,
        clientSecret: envConfig.linkedInClientSecret,
        redirectUri: envConfig.linkedInRedirectUri,
      };
    case 'youtube':
      return {
        clientId: envConfig.googleClientId,
        clientSecret: envConfig.googleClientSecret,
        redirectUri: envConfig.googleRedirectUri,
      };
    default:
      return null;
  }
};

export const updatePlatformConfig = async (platform: string, data: { clientId: string; clientSecret: string; redirectUri?: string }) => {
  const encryptedSecret = encrypt(data.clientSecret);
  return await SocialPlatformConfig.findOneAndUpdate(
    { platform: platform.toLowerCase() },
    { ...data, clientSecret: encryptedSecret, isActive: true },
    { upsert: true, new: true }
  );
};

export const getAllPlatformConfigs = async () => {
  return await SocialPlatformConfig.find();
};
