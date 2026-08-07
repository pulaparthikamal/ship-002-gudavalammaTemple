import { findShortFormNoveltyCollision, shortFormTextSimilarity } from './short-form-novelty.util';

const script = (focus: string) => Array.from({ length: 22 }, (_, index) =>
  `${focus} provides concrete operational insight number ${index + 1} for business leaders.`
).join(' ');

describe('short-form novelty', () => {
  it('detects identical AI short-form content', () => {
    const existingScript = script('Vendor risk');
    const collision = findShortFormNoveltyCollision({
      linkedin: { shortFormVideo: { title: 'The Vendor Risk Decision Leaders Miss', hook: 'Your AI vendor can become tomorrow’s operational bottleneck.', script: existingScript } },
    }, [{
      shortFormVideos: [{
        platform: 'linkedin',
        title: 'The Vendor Risk Decision Leaders Miss',
        hook: 'Your AI vendor can become tomorrow’s operational bottleneck.',
        scriptExcerpt: existingScript,
      }],
    }]);

    expect(collision?.platform).toBe('linkedin');
    expect(collision?.similarity).toBe(1);
  });

  it('allows a genuinely different angle on the same topic', () => {
    const collision = findShortFormNoveltyCollision({
      instagram: { shortFormVideo: { title: 'Why Customer Trust Changes the AI Decision', hook: 'Automation speed means little when customers stop trusting the outcome.', script: script('Customer trust') } },
    }, [{
      shortFormVideos: [{
        platform: 'instagram',
        title: 'The Hidden Cost Inside Your AI Vendor Contract',
        hook: 'The biggest automation risk may be buried in the renewal clause.',
        scriptExcerpt: script('Vendor contract'),
      }],
    }]);

    expect(collision).toBeNull();
  });

  it('returns a bounded lexical similarity score', () => {
    expect(shortFormTextSimilarity('AI workflow risk and customer trust', 'customer trust changes workflow risk')).toBeGreaterThan(0.5);
    expect(shortFormTextSimilarity('vendor contracts', 'employee training')).toBe(0);
  });
});
