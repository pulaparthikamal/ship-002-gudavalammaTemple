import { SocialAccount, ISocialAccount } from './socialAccount.model';
import { ObjectIdType } from '../../types/common.types';

export const connectAccount = async (data: Partial<ISocialAccount>): Promise<ISocialAccount> => {
  // Check if account already exists for this platform and platformAccountId
  const existing = await SocialAccount.findOne({
    userId: data.userId,
    platform: data.platform,
    platformAccountId: data.platformAccountId
  });

  if (existing) {
    return await SocialAccount.findByIdAndUpdate(existing._id, { ...data, status: 'connected' }, { new: true }) as ISocialAccount;
  }

  const account = new SocialAccount(data);
  return await account.save();
};

export const getAccounts = async (userId: ObjectIdType): Promise<ISocialAccount[]> => {
  return await SocialAccount.find({ userId, status: 'connected' });
};

export const disconnectAccount = async (id: string): Promise<ISocialAccount | null> => {
  return await SocialAccount.findByIdAndUpdate(id, { status: 'disconnected' }, { new: true });
};

export const updateAccount = async (id: string, data: Partial<ISocialAccount>): Promise<ISocialAccount | null> => {
  return await SocialAccount.findByIdAndUpdate(id, data, { new: true });
};
