import { Donor, IDonor } from './donor.model';
import { Donation } from '../donation/donation.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';

export const donorService = {
  async create(data: Partial<IDonor>) {
    return Donor.create({
      ...data,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async getById(id: string, locale: string) {
    const donor = await Donor.findOne({ _id: id, active: true });
    if (!donor) {
      throw new AppError(t('donor.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return donor;
  },

  async update(id: string, data: Partial<IDonor>, locale: string) {
    const donor = await Donor.findOneAndUpdate(
      { _id: id, active: true },
      { ...data, updated: new Date() },
      { new: true }
    );
    if (!donor) {
      throw new AppError(t('donor.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return donor;
  },

  async delete(id: string, locale: string) {
    const donor = await Donor.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );
    if (!donor) {
      throw new AppError(t('donor.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return true;
  },

  /**
   * Donation history + aggregate totals for a donor detail view.
   */
  async getDonations(id: string, locale: string) {
    const donor = await Donor.findOne({ _id: id, active: true });
    if (!donor) {
      throw new AppError(t('donor.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const donations = await Donation.find({ donorId: id })
      .populate('fundId', 'name slug')
      .sort({ created: -1 });

    const summary = await Donation.aggregate([
      { $match: { donorId: donor._id, status: 'confirmed' } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalDonations: { $sum: 1 },
        },
      },
    ]);

    return {
      donor,
      donations,
      totalAmount: summary[0]?.totalAmount ?? 0,
      totalDonations: summary[0]?.totalDonations ?? 0,
    };
  },
};
