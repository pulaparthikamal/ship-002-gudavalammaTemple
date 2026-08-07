import moment from 'moment-timezone';

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isExpired = (date: Date): boolean => {
  return new Date() > date;
};

/**
 * get one day query
 * @returns {query}
 */
export const getOneDayQuery = () => {
  const start = moment().startOf('day').toDate();
  const end = moment().endOf('day').toDate();
  return { $gte: start, $lte: end };
};

/**
 * get this week query
 * @returns {query}
 */
export const getThisWeekQuery = () => {
  const start = moment().startOf('week').toDate();
  const end = moment().endOf('week').toDate();
  return { $gte: start, $lte: end };
};

/**
 * get one month dates query
 * @returns {query}
 */
export const getOneMonthDatesQuery = () => {
  const start = moment().startOf('month').toDate();
  const end = moment().endOf('month').toDate();
  return { $gte: start, $lte: end };
};

/**
 * get three months query
 * @returns {query}
 */
export const getThreeMonthsQuery = () => {
  const start = moment().subtract(3, 'months').startOf('day').toDate();
  const end = moment().endOf('day').toDate();
  return { $gte: start, $lte: end };
};

export default {
  formatDate,
  addDays,
  isExpired,
  getOneDayQuery,
  getThisWeekQuery,
  getOneMonthDatesQuery,
  getThreeMonthsQuery,
};
