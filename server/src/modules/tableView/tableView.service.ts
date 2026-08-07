import { AppError } from '../../utils/error.util';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { TableViewPreference, type ITableViewDefinition } from './tableView.model';

interface TableViewPreferencePayload {
  activeViewId: string | null;
  views: ITableViewDefinition[];
}

function trimValue(value: string) {
  return value.trim();
}

function ensureUnique(values: string[], label: string) {
  const uniqueValues = new Set(values);

  if (uniqueValues.size !== values.length) {
    throw new AppError(`${label} must be unique.`, HTTP_STATUS.BAD_REQUEST);
  }
}

function validateViews(views: ITableViewDefinition[]) {
  const viewIds = views.map((view) => trimValue(view.id));
  const normalizedNames = views.map((view) => trimValue(view.name).toLowerCase());

  ensureUnique(viewIds, 'View ids');
  ensureUnique(normalizedNames, 'View names');

  for (const view of views) {
    const columnOrder = view.columnOrder.map(trimValue);
    const columnIds = view.columns.map((column) => trimValue(column.columnId));

    ensureUnique(columnOrder, `Column order for ${view.name}`);
    ensureUnique(columnIds, `Columns for ${view.name}`);

    if (columnOrder.length !== columnIds.length) {
      throw new AppError(
        `Column order and column visibility entries must match for ${view.name}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const orderedColumnIds = new Set(columnOrder);

    if (!columnIds.every((columnId) => orderedColumnIds.has(columnId))) {
      throw new AppError(
        `Column order and column visibility entries must contain the same column ids for ${view.name}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (!view.columns.some((column) => column.visible)) {
      throw new AppError(
        `At least one column must stay visible in ${view.name}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }
  }
}

function normalizeViews(views: ITableViewDefinition[]) {
  return views.map((view) => ({
    id: trimValue(view.id),
    name: trimValue(view.name),
    columnOrder: view.columnOrder.map(trimValue),
    columns: view.columns.map((column) => ({
      columnId: trimValue(column.columnId),
      visible: Boolean(column.visible),
    })),
  }));
}

function createEmptyPreference(tableId: string) {
  return {
    tableId,
    activeViewId: null,
    views: [],
  };
}

export const tableViewService = {
  async getByUserAndTable(userId: string, tableId: string) {
    const preference = await TableViewPreference.findOne({
      user: userId,
      tableId,
    })
      .select('tableId activeViewId views')
      .lean();

    if (!preference) {
      return createEmptyPreference(tableId);
    }

    return {
      tableId: preference.tableId,
      activeViewId: preference.activeViewId ?? null,
      views: preference.views ?? [],
    };
  },

  async upsertByUserAndTable(userId: string, tableId: string, payload: TableViewPreferencePayload) {
    validateViews(payload.views);

    if (payload.activeViewId && !payload.views.some((view) => view.id === payload.activeViewId)) {
      throw new AppError('Active view must reference a saved table view.', HTTP_STATUS.BAD_REQUEST);
    }

    if (!payload.views.length) {
      await TableViewPreference.findOneAndDelete({ user: userId, tableId });
      return createEmptyPreference(tableId);
    }

    const views = normalizeViews(payload.views);

    const preference = await TableViewPreference.findOneAndUpdate(
      { user: userId, tableId },
      {
        user: userId,
        tableId,
        activeViewId: payload.activeViewId,
        views,
        updated: new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    )
      .select('tableId activeViewId views')
      .lean();

    return {
      tableId: preference?.tableId ?? tableId,
      activeViewId: preference?.activeViewId ?? null,
      views: preference?.views ?? [],
    };
  },
};
