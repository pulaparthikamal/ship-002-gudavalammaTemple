import { Request } from 'express';
import { COMMON_CONSTANTS } from '../constants/common.constants';
import { FilterCriteria, FilterPayload } from '../types/pagination.types';

export const getPagination = (req: Request) => {
  let page: number = COMMON_CONSTANTS.DEFAULT_PAGE;
  let limit: number = COMMON_CONSTANTS.DEFAULT_LIMIT;
  let sortField: string = COMMON_CONSTANTS.DEFAULT_SORT_FIELD;
  let sortOrder: 1 | -1 = -1;
  let criteria: FilterCriteria[] = [];

  if (req.query.filter) {
    try {
      const filterObj: FilterPayload = JSON.parse(req.query.filter as string);
      if (filterObj.page !== undefined) page = Math.max(1, filterObj.page);
      if (filterObj.limit !== undefined) limit = Math.max(1, filterObj.limit);
      if (filterObj.sortfield) sortField = filterObj.sortfield;
      if (filterObj.direction) {
        sortOrder = filterObj.direction === 'asc' ? 1 : -1;
      }
      if (filterObj.criteria && Array.isArray(filterObj.criteria)) {
        criteria = filterObj.criteria;
      }
    } catch (err) {
      // Ignore parse errors and fallback
    }
  } else {
    page = Math.max(1, parseInt(req.query.page as string) || page);
    limit = Math.max(1, parseInt(req.query.limit as string) || limit);
    sortField = (req.query.sort as string) || sortField;
    sortOrder = req.query.order === 'asc' || req.query.order === '1' ? 1 : -1;
  }

  if (limit > COMMON_CONSTANTS.MAX_LIMIT) {
    limit = COMMON_CONSTANTS.MAX_LIMIT;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortField]: sortOrder };

  return { page, limit, skip, sort, criteria };
};
