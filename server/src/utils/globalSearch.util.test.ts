import { getGlobalSearchQuery } from './globalSearch.util';

describe('Global Search Utility', () => {
  it('should return empty object if search is empty', () => {
    const query = getGlobalSearchQuery('', ['name']);
    expect(query).toEqual({});
  });

  it('should return $or query for fields', () => {
    const query = getGlobalSearchQuery('test', ['name', 'email']);
    expect(query).toHaveProperty('$or');
    expect((query as any).$or.length).toBe(2);
  });
});
