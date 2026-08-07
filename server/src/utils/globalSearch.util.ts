export const getGlobalSearchQuery = (search: string, fields: string[]) => {
  if (!search || !search.trim()) {
    return {};
  }

  const searchRegex = new RegExp(search.trim(), 'i');

  const orConditions = fields.map((field) => ({
    [field]: searchRegex,
  }));

  return { $or: orConditions };
};
