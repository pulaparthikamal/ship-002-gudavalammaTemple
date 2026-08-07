import { Types } from 'mongoose';
import { FilterCriteria } from '../types/pagination.types';

export const getCriteriaSearchQuery = (criteria: FilterCriteria[]) => {
  const query: Record<string, any> = {};

  criteria.forEach(c => {
    let value = c.value;
    
    // Convert string booleans to actual booleans
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Convert valid ObjectId strings to ObjectIds
    else if (typeof value === 'string' && Types.ObjectId.isValid(value) && value.length === 24) {
      value = new Types.ObjectId(value);
    }
    // We avoid automatically casting numeric strings to numbers to prevent breaking phone numbers etc.,
    // unless you want to add specific fields or a strict regex check.

    switch (c.type) {
      case 'eq':
        query[c.key] = value;
        break;
      case 'ne':
        query[c.key] = { $ne: value };
        break;
      case 'contains':
      case 'like':
        query[c.key] = { $regex: new RegExp(String(value), 'i') };
        break;
      case 'gt':
        query[c.key] = { ...query[c.key], $gt: value };
        break;
      case 'gte':
        query[c.key] = { ...query[c.key], $gte: value };
        break;
      case 'lt':
        query[c.key] = { ...query[c.key], $lt: value };
        break;
      case 'lte':
        query[c.key] = { ...query[c.key], $lte: value };
        break;
      case 'in':
        query[c.key] = { $in: Array.isArray(value) ? value : [value] };
        break;
      default:
        query[c.key] = value;
    }
  });

  return query;
};
