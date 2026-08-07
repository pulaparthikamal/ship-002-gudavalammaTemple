export interface SocialApprovalEmailTemplateInput {
  appName: string;
  topic?: string;
  content: string;
  platforms: string[];
  scheduledAt: string;
  mediaUrl?: string | null;
  imageCid?: string | null;
  // Direct approve/reject links (called from email)
  approveUrl: string;
  rejectUrl: string;
  // Preview page link (opens rich HTML preview with approve/reject buttons)
  previewUrl: string;
  platformSpecificContent?: any;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildSocialApprovalEmailHtml = (input: SocialApprovalEmailTemplateInput) => {
  const escapedContent = escapeHtml(input.content);
  const escapedTopic = escapeHtml(input.topic || 'AI social media post');
  const escapedPlatforms = input.platforms.map(escapeHtml).join(', ');
  const escapedScheduledAt = escapeHtml(input.scheduledAt);

  // Brief content preview (first 300 chars)
  const contentPreview = escapeHtml(input.content?.slice(0, 300) || '') + (input.content?.length > 300 ? '...' : '');

  return `
    <div style="font-family: Arial, sans-serif; color: #202124; line-height: 1.5; max-width: 720px; background: #fff; border-radius: 12px; overflow: hidden;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 28px 32px;">
        <h2 style="margin: 0; color: #fff; font-size: 20px; font-weight: 700;">AI Social Media Post — Approval Required</h2>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">
          Scheduled for <strong>${escapedScheduledAt}</strong> on <strong>${escapedPlatforms}</strong>
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 28px 32px;">
        <table style="border-collapse: collapse; margin: 0 0 20px; width: 100%; background: #f8fafd; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="font-weight: 700; padding: 10px 16px; width: 110px; background: #f1f5fb; font-size: 13px; color: #5f6368;">Topic</td>
            <td style="padding: 10px 16px; font-size: 13px;">${escapedTopic}</td>
          </tr>
          <tr>
            <td style="font-weight: 700; padding: 10px 16px; background: #f1f5fb; font-size: 13px; color: #5f6368;">Platforms</td>
            <td style="padding: 10px 16px; font-size: 13px;">${escapedPlatforms}</td>
          </tr>
          <tr>
            <td style="font-weight: 700; padding: 10px 16px; background: #f1f5fb; font-size: 13px; color: #5f6368;">Scheduled</td>
            <td style="padding: 10px 16px; font-size: 13px;">${escapedScheduledAt}</td>
          </tr>
        </table>

        <!-- Content snippet -->
        <div style="margin: 0 0 20px;">
          <div style="font-weight: 700; font-size: 12px; color: #5f6368; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Content Preview</div>
          <div style="white-space: pre-wrap; border: 1px solid #dadce0; border-radius: 8px; padding: 14px; background: #fafafa; font-size: 13px; color: #202124; line-height: 1.6;">${contentPreview}</div>
        </div>

        ${
          input.imageCid
            ? `<div style="margin: 0 0 20px;">
                <div style="font-weight: 700; font-size: 12px; color: #5f6368; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Generated Image</div>
                <img src="cid:${escapeHtml(input.imageCid)}" alt="Post media" style="max-width: 100%; border: 1px solid #dadce0; border-radius: 8px; display:block;" />
              </div>`
            : input.mediaUrl
            ? `<div style="margin: 0 0 20px;">
                <div style="font-weight: 700; font-size: 12px; color: #5f6368; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Generated Image</div>
                <img src="${escapeHtml(input.mediaUrl)}" alt="Post media" style="max-width: 100%; border: 1px solid #dadce0; border-radius: 8px; display:block;" />
              </div>`
            : ''
        }

        <!-- CTA Buttons -->
        <div style="margin: 28px 0 8px; font-weight: 700; font-size: 14px; color: #202124;">Review this post:</div>

        <!-- Primary: Preview button -->
        <p style="margin: 0 0 16px;">
          <a href="${escapeHtml(input.previewUrl)}"
             style="background: #1a73e8; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; display: inline-block; font-weight: 700; font-size: 14px; letter-spacing: 0.01em;">
            🔍 Preview Post &amp; Take Action
          </a>
        </p>

        <!-- Quick actions (one-click without preview) -->
        <p style="margin: 0 0 4px; font-size: 12px; color: #5f6368;">Or take action directly:</p>
        <p style="margin: 0 0 24px;">
          <a href="${escapeHtml(input.approveUrl)}"
             style="background: #1e7e34; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; margin-right: 10px; font-weight: 700; font-size: 13px;">
            ✅ Approve
          </a>
          <a href="${escapeHtml(input.rejectUrl)}"
             style="background: #c82333; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: 700; font-size: 13px;">
            ❌ Reject
          </a>
        </p>

        <p style="color: #5f6368; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
          Links expire in 7 days. Approving will schedule the post for auto-publishing at the listed time.<br />
          This email was sent by ${escapeHtml(input.appName)}.
        </p>
      </div>
    </div>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// Rich HTML preview page (shown when clicking "Preview Post & Take Action")
// ─────────────────────────────────────────────────────────────────────────────
export interface PreviewPageInput {
  topic?: string;
  content: string;
  platforms: string[];
  scheduledAt: string;
  mediaUrl?: string | null;
  platformSpecificContent?: any;
  approveUrl: string;
  rejectUrl: string;
  alreadyActioned?: 'approved' | 'rejected';
}

const joinList = (values?: unknown[]) =>
  Array.isArray(values) && values.length ? values.map((value, index) => `${index + 1}. ${String(value)}`).join('\n') : '';

const formatChapters = (chapters?: Array<{ timestamp?: string; title?: string }>) =>
  Array.isArray(chapters) && chapters.length
    ? chapters.map((chapter) => `${chapter.timestamp || '-'} ${chapter.title || 'Untitled chapter'}`).join('\n')
    : '';

const hasMarkdownSection = (text: string | undefined, section: string) => {
  if (!text?.trim()) return false;
  return new RegExp(`^\\s*#+\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(text);
};

const formatYoutubePreviewBody = (data: any) => {
  const description = typeof data.description === 'string' ? data.description : '';
  const sections = [
    ['Title', data.title, ''],
    ['Description', description, ''],
    ['Video Angle', data.video_angle, 'Video Angle'],
    ['Target Audience', data.target_audience, 'Target Audience'],
    ['Business Summary', data.business_summary, 'Business Summary'],
    ['Why Watch Now', data.why_watch_now, 'Why Watch Now'],
    ['Business Impact & Opportunities', data.business_impact_opportunities, 'Business Impact & Opportunities'],
    ['Key Talking Points', joinList(data.key_talking_points), 'Key Talking Points'],
    ['Actionable Recommendations', joinList(data.actionable_recommendations), 'Actionable Recommendations'],
    ['Proof Points Or Examples', joinList(data.proof_points_or_examples), 'Proof Points Or Examples'],
    ['Viewer Takeaways', joinList(data.viewer_takeaways), 'Viewer Takeaways'],
    ['Discussion Question', data.discussion_question, 'Discussion Question'],
    ['Chapters', formatChapters(data.chapters), 'Chapter-By-Chapter Content'],
    ['Tags', Array.isArray(data.tags) ? data.tags.join(', ') : '', ''],
    ['Thumbnail Text', data.thumbnail_text, ''],
    ['Thumbnail Concept', data.thumbnail_concept, ''],
    ['Pinned Comment', data.pinned_comment, ''],
    ['Community Post', data.community_post, ''],
    ['Shorts Ideas', joinList(data.shorts_ideas), 'Shorts Ideas'],
    ['Script', data.script, ''],
  ];

  return sections
    .filter(([, value, sectionName]) => {
      if (sectionName && hasMarkdownSection(description, String(sectionName))) return false;
      return typeof value === 'string' && value.trim();
    })
    .map(([label, value]) => `## ${label}\n${value}`)
    .join('\n\n');
};

const formatShortFormPreviewBody = (data: any) => {
  const video = data?.shortFormVideo || data?.short_form_video;
  if (!video || typeof video !== 'object') return '';

  if (video.presentation?.replace_fallback) {
    const requestedSections = Array.isArray(video.presentation.sections)
      ? video.presentation.sections
          .filter((section: any) => typeof section?.content === 'string' && section.content.trim())
          .map((section: any) => `## ${section.label || section.key || 'Section'}\n${section.content}`)
      : [];
    return requestedSections.join('\n\n');
  }

  const sections = [
    ['Short-Form Video Title', video.title],
    ['Duration', video.duration_seconds || video.durationSeconds ? `${video.duration_seconds || video.durationSeconds} seconds` : '60 seconds'],
    ['Hook', video.hook],
    ['Script', video.script],
    ['Thumbnail Text', video.thumbnail_text || video.thumbnailText],
    ['Thumbnail Concept', video.thumbnail_concept || video.thumbnailConcept],
    ['Hashtags', Array.isArray(video.hashtags) ? video.hashtags.join(' ') : ''],
  ];

  return sections
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([label, value]) => `## ${label}\n${value}`)
    .join('\n\n');
};

export const buildApprovalPreviewHtml = (input: PreviewPageInput): string => {
  const esc = (v: string) => v
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const topic = esc(input.topic || 'AI Social Media Post');
  const platforms = input.platforms.map(esc).join(', ');
  const scheduledAt = esc(new Date(input.scheduledAt).toLocaleString());

  // Build platform content sections
  const psc = input.platformSpecificContent || {};
  const platformSections = Object.entries(psc).map(([platform, data]: [string, any]) => {
    const platformColors: Record<string, string> = {
      instagram: '#E1306C',
      facebook: '#1877F2',
      linkedin: '#0A66C2',
      youtube: '#FF0000',
    };
    const color = platformColors[platform.toLowerCase()] || '#6366f1';
    const body = platform.toLowerCase() === 'youtube'
      ? formatYoutubePreviewBody(data)
      : data.content
        || (data.caption ? `${data.caption}${data.hashtags?.length ? '\n\n' + data.hashtags.join(' ') : ''}` : '')
        || (data.title ? `${data.title}\n\n${data.description || ''}${data.tags?.length ? '\n\n' + data.tags.join(' ') : ''}` : '');
    const shortFormBody = formatShortFormPreviewBody(data);
    const shortFormVideo = data?.shortFormVideo || data?.short_form_video;
    const shortFormLabel = shortFormVideo?.presentation?.replace_fallback
      ? shortFormVideo.presentation.title || 'Custom Video Script'
      : `${shortFormVideo?.duration_seconds || shortFormVideo?.durationSeconds || 60}-Second Video Script`;

    return `
      <div style="margin-bottom:20px; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="padding:10px 16px; font-weight:700; font-size:13px; text-transform:capitalize; color:#fff; background:${color};">
          ${esc(platform)} Content
        </div>
        <div style="padding:16px; white-space:pre-wrap; font-size:14px; line-height:1.7; color:#374151; background:#fafafa;">
          ${esc(body)}
        </div>
        ${shortFormBody ? `
          <div style="margin:0 16px 16px; padding:14px; white-space:pre-wrap; font-size:13px; line-height:1.65; color:#374151; background:#fff; border:1px solid #e2e8f0; border-radius:8px;">
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:${color}; letter-spacing:.06em; margin-bottom:8px;">${esc(shortFormLabel)}</div>
            ${esc(shortFormBody)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const actionBar = input.alreadyActioned
    ? `<div style="padding:20px; border-radius:12px; text-align:center; background:${input.alreadyActioned === 'approved' ? '#f0fdf4' : '#fef2f2'}; border:2px solid ${input.alreadyActioned === 'approved' ? '#86efac' : '#fca5a5'};">
        <p style="font-size:18px; font-weight:800; color:${input.alreadyActioned === 'approved' ? '#16a34a' : '#dc2626'}; margin:0;">
          ${input.alreadyActioned === 'approved' ? '✅ This post has already been approved.' : '❌ This post has already been rejected.'}
        </p>
      </div>`
    : `<div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:32px;">
        <a href="${esc(input.approveUrl)}"
           style="flex:1; min-width:160px; text-align:center; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; text-decoration:none; padding:16px 28px; border-radius:10px; display:inline-block; font-weight:800; font-size:16px; letter-spacing:0.02em; box-shadow:0 4px 15px rgba(22,163,74,0.35);">
          ✅ Approve &amp; Schedule
        </a>
        <a href="${esc(input.rejectUrl)}"
           style="flex:1; min-width:160px; text-align:center; background:linear-gradient(135deg,#dc2626,#b91c1c); color:#fff; text-decoration:none; padding:16px 28px; border-radius:10px; display:inline-block; font-weight:800; font-size:16px; letter-spacing:0.02em; box-shadow:0 4px 15px rgba(220,38,38,0.35);">
          ❌ Reject Post
        </a>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Post Approval Preview — ${topic}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px 48px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f1f5f9; color: #1e293b; }
    .card { max-width: 780px; margin: 0 auto; background: #fff; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,0,0,.10); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a73e8, #0d47a1); padding: 32px; color: #fff; }
    .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 800; }
    .header p { margin: 0; font-size: 14px; opacity: .85; }
    .body { padding: 32px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafd; border-radius: 12px; padding: 20px; margin-bottom: 28px; border: 1px solid #e2e8f0; }
    .meta-item label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-bottom: 4px; }
    .meta-item span { font-size: 14px; font-weight: 600; color: #1e293b; }
    .section-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 10px; }
    .content-box { background: #f8fafd; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; font-size: 14px; line-height: 1.75; white-space: pre-wrap; color: #374151; margin-bottom: 28px; }
    .media-img { width: 100%; border-radius: 12px; border: 1px solid #e2e8f0; display: block; margin-bottom: 28px; }
    @media (max-width: 540px) { .meta-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📋 Post Approval Preview</h1>
      <p>Review the AI-generated content below, then approve or reject.</p>
    </div>
    <div class="body">
      <div class="meta-grid">
        <div class="meta-item"><label>Topic</label><span>${topic}</span></div>
        <div class="meta-item"><label>Platforms</label><span>${platforms}</span></div>
        <div class="meta-item"><label>Scheduled At</label><span>${scheduledAt}</span></div>
        <div class="meta-item"><label>Post Type</label><span>AI Generated</span></div>
      </div>

      ${input.mediaUrl ? `<div class="section-label">Generated Image</div>
      <img src="${esc(input.mediaUrl)}" class="media-img" alt="Post media" />` : ''}

      ${Object.keys(psc).length > 0
        ? `<div class="section-label">Platform-Optimised Content</div>${platformSections}`
        : `<div class="section-label">Content</div>
           <div class="content-box">${esc(input.content)}</div>`
      }

      ${actionBar}

      <p style="margin-top:28px; font-size:12px; color:#94a3b8; text-align:center;">
        These links expire in 7 days. You can close this tab after taking action.
      </p>
    </div>
  </div>
</body>
</html>`;
};
