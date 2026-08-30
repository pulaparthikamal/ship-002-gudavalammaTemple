import { Types } from 'mongoose';
import { ExpenseEntry } from './expenseEntry.model';
import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { t } from '../../i18n';
import { bulkExpenseEntryRowSchema } from './expenseEntry.schema';

/**
 * Merge explicit eventId/from/to query params into the mongo filter produced by generateListQuery.
 */
const applyQueryFilters = (filter: Record<string, any>, query: any) => {
  const { eventId, from, to } = query || {};

  if (eventId && Types.ObjectId.isValid(String(eventId))) {
    filter.eventId = new Types.ObjectId(String(eventId));
  }

  if (from || to) {
    filter.date = filter.date || {};
    if (from) filter.date.$gte = new Date(String(from));
    if (to) filter.date.$lte = new Date(String(to));
  }

  return filter;
};

export const expenseEntryService = {
  applyQueryFilters,

  async create(data: any, createdBy: string) {
    return ExpenseEntry.create({
      ...data,
      createdBy,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async getById(id: string, locale: string) {
    const expenseEntry = await ExpenseEntry.findOne({ _id: id, active: true });
    if (!expenseEntry) {
      throw new AppError(t('expenseEntry.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return expenseEntry;
  },

  async update(id: string, data: any, locale: string) {
    data.updated = new Date();
    const expenseEntry = await ExpenseEntry.findOneAndUpdate({ _id: id, active: true }, data, { new: true });
    if (!expenseEntry) {
      throw new AppError(t('expenseEntry.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    return expenseEntry;
  },

  async delete(id: string, locale: string) {
    const expenseEntry = await ExpenseEntry.findOneAndUpdate(
      { _id: id, active: true },
      { active: false, updated: new Date() },
      { new: true }
    );

    if (!expenseEntry) {
      throw new AppError(t('expenseEntry.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async summary(query: any) {
    const match: Record<string, any> = { active: true };
    applyQueryFilters(match, query);

    const rows = await ExpenseEntry.aggregate([
      { $match: match },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const totals: Record<string, number> = { income: 0, expense: 0 };
    for (const row of rows) {
      if (row._id === 'income' || row._id === 'expense') {
        totals[row._id] = row.total;
      }
    }

    return {
      totalIncome: totals.income,
      totalExpense: totals.expense,
      net: totals.income - totals.expense,
    };
  },

  async bulkCreate(entries: any[], createdBy: string) {
    const created: any[] = [];
    const errors: Array<{ index: number; row: any; message: string }> = [];
    const validRows: any[] = [];

    entries.forEach((row, index) => {
      const parsed = bulkExpenseEntryRowSchema.safeParse(row);
      if (!parsed.success) {
        errors.push({
          index,
          row,
          message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        });
        return;
      }

      validRows.push({
        ...parsed.data,
        createdBy,
        active: true,
        created: new Date(),
        updated: new Date(),
      });
    });

    if (validRows.length > 0) {
      const inserted = await ExpenseEntry.insertMany(validRows, { ordered: false });
      created.push(...inserted);
    }

    return { created, errors };
  },
};
