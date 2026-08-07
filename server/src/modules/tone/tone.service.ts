import { Tone, ITone } from './tone.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const getTones = async () => {
  return Tone.find({ active: true }).sort({ sortOrder: 1, name: 1 });
};

export const createTone = async (data: Partial<ITone>) => {
  return Tone.create(data);
};

export const deleteTone = async (id: string, locale: string) => {
  const tone = await Tone.findById(id);
  if (!tone) {
    throw new AppError(t('tone.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
  }

  await tone.deleteOne();
  return tone;
};
