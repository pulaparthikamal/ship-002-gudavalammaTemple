import { Types } from 'mongoose';

export const getTableSearchQuery = (query: Record<string, any>, allowedFilters: string[]) => {
  const filterQuery: Record<string, any> = {};

  allowedFilters.forEach((key) => {
    if (query[key] !== undefined && query[key] !== '') {
      let value = query[key];
      
      // Handle boolean strings
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      
      // Handle ObjectId
      else if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        value = new Types.ObjectId(value);
      }
      
      // Handle numeric strings loosely
      else if (typeof value === 'string' && !isNaN(Number(value))) {
        value = Number(value);
      }

      filterQuery[key] = value;
    }
  });

  return filterQuery;
};
