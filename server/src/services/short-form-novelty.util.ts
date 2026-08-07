const platforms = ['instagram', 'facebook', 'linkedin'] as const;

const stopWords = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could', 'every', 'from',
  'have', 'into', 'more', 'most', 'only', 'other', 'should', 'that', 'their', 'there', 'these', 'they',
  'this', 'those', 'through', 'very', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);

const normalize = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const tokens = (value: unknown) => new Set(
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word)),
);

export const shortFormTextSimilarity = (left: unknown, right: unknown) => {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
};

interface PriorShortFormVideo {
  platform?: string;
  title?: string;
  hook?: string;
  scriptExcerpt?: string;
  scriptEnding?: string;
  thumbnailText?: string;
}

interface NoveltyHistoryItem {
  shortFormVideos?: PriorShortFormVideo[];
}

export interface ShortFormNoveltyCollision {
  platform: string;
  similarity: number;
  title: string;
  hook: string;
  scriptExcerpt: string;
  previousTitle: string;
  previousHook: string;
}

export const findShortFormNoveltyCollision = (
  platformSpecificContent: Record<string, any> | undefined,
  history: NoveltyHistoryItem[],
  threshold = 0.58,
): ShortFormNoveltyCollision | null => {
  let strongest: ShortFormNoveltyCollision | null = null;

  for (const platform of platforms) {
    const item = platformSpecificContent?.[platform];
    const video = item?.shortFormVideo || item?.short_form_video;
    if (!video) continue;

    const title = String(video.title || '').trim();
    const hook = String(video.hook || '').trim();
    const script = String(video.script || '').trim();
    const candidate = `${title} ${hook} ${script}`;

    for (const historyItem of history) {
      for (const prior of historyItem.shortFormVideos || []) {
        if (prior.platform && prior.platform !== platform) continue;
        const previous = `${prior.title || ''} ${prior.hook || ''} ${prior.scriptExcerpt || ''} ${prior.scriptEnding || ''}`;
        const exactTitle = Boolean(title && normalize(title) === normalize(prior.title));
        const exactHook = Boolean(hook && normalize(hook) === normalize(prior.hook));
        const similarity = exactTitle || exactHook ? 1 : shortFormTextSimilarity(candidate, previous);
        if (!strongest || similarity > strongest.similarity) {
          strongest = {
            platform,
            similarity,
            title,
            hook,
            scriptExcerpt: script.slice(0, 900),
            previousTitle: prior.title || '',
            previousHook: prior.hook || '',
          };
        }
      }
    }
  }

  return strongest && strongest.similarity >= threshold ? strongest : null;
};
