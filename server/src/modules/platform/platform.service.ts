import { Platform, IPlatform } from './platform.model';

export const getPlatforms = async () => {
  return Platform.find({ active: true }).sort({ name: 1 });
};

export const createPlatform = async (data: Partial<IPlatform>) => {
  return Platform.create(data);
};

export const deletePlatform = async (id: string) => {
  return Platform.findByIdAndDelete(id);
};
