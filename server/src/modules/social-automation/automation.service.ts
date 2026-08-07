import { Automation, IAutomation } from './automation.model';
import { ObjectIdType } from '../../types/common.types';
import { Post } from '../posts/post.model';
import { seedPostsForAutomation } from '../../jobs/automationSeedCron';
import { logger } from '../../utils/logger.util';
import { addCategoryAudienceSuggestion, addCategoryInterest } from '../categories/category.service';

const triggerImmediateSeeding = (automationId: string) => {
  // Run asynchronously so we don't block the API response
  setTimeout(async () => {
    try {
      const populated = await Automation.findById(automationId).populate('categoryId');
      if (populated && populated.isActive && !populated.isDeleted) {
        const now = new Date();
        const postingWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours lookback
        const postingWindowEnd = new Date(now.getTime() + 13 * 60 * 60 * 1000); // 13 hours lookahead
        logger.info(`[AutomationService] Triggering immediate seeding for automation ${populated._id}`);
        await seedPostsForAutomation(populated, postingWindowStart, postingWindowEnd);
      }
    } catch (err: any) {
      logger.error(`[AutomationService] Immediate seeding failed for automation ${automationId}:`, err.message);
    }
  }, 0);
};

export const createAutomation = async (data: Partial<IAutomation>): Promise<IAutomation> => {
  await addCategoryInterest(data.categoryId, data.interests?.[0]);
  await addCategoryAudienceSuggestion(data.categoryId, data.targetAudience);
  const automation = new Automation(data);
  const saved = await automation.save();
  if (saved.isActive && !saved.isDeleted) {
    triggerImmediateSeeding(String(saved._id));
  }
  return saved;
};

export const getAutomations = async (userId: ObjectIdType): Promise<IAutomation[]> => {
  return await Automation.find({ userId, isDeleted: false }).populate('categoryId');
};

export const getAutomationsPaged = async (
  userId: ObjectIdType,
  filters: any = {},
  page: number = 1,
  limit: number = 20,
  sortfield: string = 'createdAt',
  direction: string = 'desc'
): Promise<{ automations: IAutomation[]; total: number }> => {
  const skip = (page - 1) * limit;
  const sortDirection = direction === 'desc' ? -1 : 1;
  const sortOptions: any = {};
  sortOptions[sortfield] = sortDirection;

  const query = { userId, isDeleted: false, ...filters };

  const [automations, total] = await Promise.all([
    Automation.find(query).sort(sortOptions).skip(skip).limit(limit).populate('categoryId'),
    Automation.countDocuments(query)
  ]);

  return { automations, total };
};


export const updateAutomation = async (id: string, data: Partial<IAutomation>): Promise<IAutomation | null> => {
  await addCategoryInterest(data.categoryId, data.interests?.[0]);
  await addCategoryAudienceSuggestion(data.categoryId, data.targetAudience);
  // Delete any future pending posts so they are regenerated with the updated configuration
  await Post.deleteMany({
    automationId: id,
    status: { $in: ['waiting_for_approval', 'scheduled', 'paused', 'pending', 'pending_approval'] }
  });

  const updated = await Automation.findByIdAndUpdate(id, data, { new: true });
  if (updated && updated.isActive && !updated.isDeleted) {
    triggerImmediateSeeding(String(updated._id));
  }
  return updated;
};

export const deleteAutomation = async (id: string): Promise<IAutomation | null> => {
  const deleted = await Automation.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  if (deleted) {
    // Delete all posts associated with the deleted automation rule
    await Post.deleteMany({ automationId: id });
  }
  return deleted;
};

export const toggleAutomationPause = async (id: string): Promise<IAutomation | null> => {
  const automation = await Automation.findById(id);
  if (!automation) throw new Error('Automation not found');

  automation.isActive = !automation.isActive;
  await automation.save();

  if (!automation.isActive) {
    // Paused
    await Post.updateMany(
      { automationId: id, status: { $in: ['scheduled', 'waiting_for_approval', 'pending'] } },
      { $set: { status: 'paused' } }
    );
  } else {
    // Resumed
    await Post.updateMany(
      { automationId: id, status: 'paused', approvalStatus: { $in: ['not_required', 'approved'] } },
      { $set: { status: 'scheduled' } }
    );
    await Post.updateMany(
      { automationId: id, status: 'paused', approvalStatus: { $nin: ['not_required', 'approved'] } },
      { $set: { status: 'waiting_for_approval' } }
    );

    // Trigger seeding immediately upon resumption
    triggerImmediateSeeding(id);
  }

  return automation;
};
