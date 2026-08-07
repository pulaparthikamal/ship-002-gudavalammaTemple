import { Category, ICategory } from './category.model';
import { AudienceSuggestion } from './audience-suggestion.model';
import { ObjectIdType } from '../../types/common.types';

const normalizeSuggestion = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, 500) : '');
const normalizeKey = (value: string) => value.trim().toLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueSuggestions = (values: unknown[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeSuggestion(value);
    if (!normalized) continue;

    const key = normalizeKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
};

export const addAudienceSuggestion = async (userId: ObjectIdType | undefined, audience: unknown): Promise<void> => {
  const normalizedAudience = normalizeSuggestion(audience);
  if (!userId || !normalizedAudience) return;

  await AudienceSuggestion.updateOne(
    { userId, normalizedValue: normalizeKey(normalizedAudience) },
    { $setOnInsert: { userId, value: normalizedAudience, normalizedValue: normalizeKey(normalizedAudience) } },
    { upsert: true },
  );
};

export const addAudienceSuggestions = async (userId: ObjectIdType | undefined, audiences: unknown): Promise<void> => {
  const values = Array.isArray(audiences) ? audiences : [audiences];
  for (const audience of uniqueSuggestions(values)) {
    await addAudienceSuggestion(userId, audience);
  }
};

export const getAudienceSuggestions = async (userId: ObjectIdType): Promise<string[]> => {
  const globalSuggestions = await AudienceSuggestion.find({ userId }).sort({ value: 1 }).lean();
  const categories = await Category.find({ userId, isDeleted: false }).select({ audienceSuggestions: 1 }).lean();

  return uniqueSuggestions([
    ...globalSuggestions.map((suggestion) => suggestion.value),
    ...categories.flatMap((category) => category.audienceSuggestions || []),
  ]).sort((a, b) => a.localeCompare(b));
};

const withGlobalAudienceSuggestions = async (categories: ICategory[], userId: ObjectIdType): Promise<ICategory[]> => {
  const audienceSuggestions = await getAudienceSuggestions(userId);
  return categories.map((category) => {
    category.audienceSuggestions = audienceSuggestions;
    return category;
  });
};

export const createCategory = async (data: Partial<ICategory>): Promise<ICategory> => {
  const category = new Category(data);
  const savedCategory = await category.save();
  await addAudienceSuggestions(savedCategory.userId, data.audienceSuggestions);
  savedCategory.audienceSuggestions = await getAudienceSuggestions(savedCategory.userId);
  return savedCategory;
};

export const getCategories = async (userId: ObjectIdType): Promise<ICategory[]> => {
  const categories = await Category.find({ userId, isDeleted: false });
  return await withGlobalAudienceSuggestions(categories, userId);
};

export const updateCategory = async (id: string, data: Partial<ICategory>): Promise<ICategory | null> => {
  const category = await Category.findByIdAndUpdate(id, data, { new: true });
  if (!category) return null;

  await addAudienceSuggestions(category.userId, data.audienceSuggestions);
  category.audienceSuggestions = await getAudienceSuggestions(category.userId);
  return category;
};

export const addCategoryInterest = async (id: string | ObjectIdType | undefined, interest: unknown): Promise<void> => {
  const normalizedInterest = normalizeSuggestion(interest);
  if (!id || !normalizedInterest) return;

  await Category.updateOne(
    { _id: id, isDeleted: false },
    { $addToSet: { interests: normalizedInterest } }
  );
};

export const addCategoryAudienceSuggestion = async (id: string | ObjectIdType | undefined, audience: unknown): Promise<void> => {
  const normalizedAudience = normalizeSuggestion(audience);
  if (!id || !normalizedAudience) return;

  const category = await Category.findOne({ _id: id, isDeleted: false }).select({ userId: 1 });
  if (!category) return;

  await addAudienceSuggestion(category.userId, normalizedAudience);

  await Category.updateOne(
    { _id: id, isDeleted: false },
    { $addToSet: { audienceSuggestions: normalizedAudience } }
  );
};

export const deleteAudienceSuggestion = async (userId: ObjectIdType, audience: unknown): Promise<void> => {
  const normalizedAudience = normalizeSuggestion(audience);
  if (!normalizedAudience) return;

  await AudienceSuggestion.deleteOne({ userId, normalizedValue: normalizeKey(normalizedAudience) });
  await Category.updateMany(
    { userId, isDeleted: false },
    { $pull: { audienceSuggestions: new RegExp(`^${escapeRegex(normalizedAudience)}$`, 'i') } },
  );
};

export const deleteCategory = async (id: string): Promise<ICategory | null> => {
  return await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
};
