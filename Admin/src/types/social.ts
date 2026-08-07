import type { EntityId } from './common';

export interface SocialCategory {
  _id: EntityId;
  name: string;
  interests: string[];
  audienceSuggestions?: string[];
  isActive: boolean;
  createdAt?: string;
}

export interface SocialAudienceSuggestion {
  value: string;
}

export interface SocialAutomation {
  _id: EntityId;
  categoryId: string | SocialCategory;
  interests: string[];
  targetAudience?: string;
  tone: string;
  mediaType: 'image' | 'video' | 'text';
  platforms: string[];
  frequency: 'daily' | 'weekly' | 'custom' | 'fixed';
  customDays?: string[];
  fixedDate?: string;
  startDate?: string;
  endDate?: string;
  time: string;
  isActive: boolean;
  approvalEmail?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt?: string;
}

export interface SocialAccount {
  _id: EntityId;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'youtube';
  platformAccountId: string;
  platformAccountName: string;
  status: 'connected' | 'disconnected';
}

export interface ShortFormVideoContent {
  duration_seconds?: number;
  title?: string;
  hook?: string;
  script?: string;
  thumbnail_text?: string;
  thumbnail_concept?: string;
  hashtags?: string[];
  presentation?: {
    replace_fallback?: boolean;
    title?: string;
    sections?: Array<{ key?: string; label?: string; content?: string }>;
    structure?: string[];
    word_count?: { min?: number; max?: number } | null;
    duration_source?: 'explicit' | 'fallback';
    word_count_source?: 'explicit' | 'duration_derived' | 'fallback';
    timeline?: VideoTimelineSection[];
  };
}

export interface VideoTimelineSection {
  label?: string;
  start_seconds?: number;
  end_seconds?: number;
  timestamp?: string;
  word_min?: number;
  word_max?: number;
}

export interface GenerationBrief {
  mode: 'simple_topic' | 'custom_brief';
  explicit_dimensions?: string[];
  requested_platforms?: string[];
  resolved_platforms?: string[];
  duration_seconds?: number | null;
  fallback_audience?: string;
  fallback_tone?: string;
  resolved_summary?: string;
  video_card?: {
    replace_fallback?: boolean;
    title?: string;
    duration_seconds?: number | null;
    fields?: Array<{ key: string; label: string }>;
    structure?: string[];
    word_count?: { min: number; max: number } | null;
    duration_source?: 'explicit' | 'fallback';
    word_count_source?: 'explicit' | 'duration_derived' | 'fallback';
    timeline?: VideoTimelineSection[];
  };
}

export interface CreatorResearchSource {
  platform?: string;
  title?: string;
  url?: string;
  published_at?: string | null;
}

export interface CreatorResearchDiscussion {
  rank?: number;
  headline?: string;
  why_people_are_talking?: string;
  emotional_hook?: string;
  debate_or_tension?: string;
  why_audience_cares?: string;
  discussion_count?: number;
  sources?: CreatorResearchSource[];
}

export interface CreatorResearchInformation {
  type: 'creator_research';
  audience?: string;
  research_window?: { hours?: number; from?: string; to?: string };
  source_coverage?: Record<string, string>;
  themes?: Array<{ name?: string; discussion_count?: number }>;
  top_discussions?: CreatorResearchDiscussion[];
  warnings?: string[];
}

export interface OpenAiWebSearchMasterArticle {
  headline?: string;
  timeframe?: string;
  overview?: string;
  key_updates?: string[];
  why_it_matters?: string[];
  watch_next?: string[];
  source_notes?: string[];
}

export interface OpenAiWebSearchInformation {
  source_type: 'openai_web_search';
  lookback_hours?: number;
  search_context_size?: 'low' | 'medium' | 'high' | string;
  source_urls?: string[];
  master_article?: OpenAiWebSearchMasterArticle;
  raw_api_response?: string;
  raw_main_content?: string;
}

export type SocialAdditionalInformation = CreatorResearchInformation | OpenAiWebSearchInformation | Record<string, any>;

export interface SocialPost {
  _id: EntityId;
  automationId?: string | SocialAutomation;
  categoryId?: string | SocialCategory;
  postType: 'ai' | 'manual';
  postingMode?: 'now' | 'schedule';
  sourceTopic?: string;
  topic?: string;
  targetAudience?: string;
  content: string;
  mediaUrl?: string;
  mediaUrls?: string[];   // multiple images (LinkedIn carousel etc.)
  videoUrl?: string;
  tone?: string;
  platforms: string[];
  status: 'pending_approval' | 'waiting_for_approval' | 'scheduled' | 'pending' | 'posted' | 'failed' | 'paused';
  approvalStatus?: 'not_required' | 'content_generation_pending' | 'email_sent' | 'approved' | 'rejected';
  approvalRequestedAt?: string;
  approvedAt?: string;
  approvedByEmail?: string;  // who the approval email was sent to (set at seed time)
  rejectedAt?: string;
  rejectionReason?: string;
  scheduledAt: string;
  postedAt?: string;
  createdAt?: string;
  errorMessage?: string;
  additionalInformation?: SocialAdditionalInformation | null;
  generationBrief?: GenerationBrief | null;
  platformSpecificContent?: {
    instagram?: { caption: string; hashtags: string[]; shortFormVideo?: ShortFormVideoContent; short_form_video?: ShortFormVideoContent };
    facebook?: { caption: string; hashtags: string[]; shortFormVideo?: ShortFormVideoContent; short_form_video?: ShortFormVideoContent };
    twitter?: { content: string };
    linkedin?: { content: string; hashtags: string[]; shortFormVideo?: ShortFormVideoContent; short_form_video?: ShortFormVideoContent };
    youtube?: {
      title: string;
      description: string;
      video_angle?: string;
      target_audience?: string;
      business_summary?: string;
      why_watch_now?: string;
      business_impact_opportunities?: string;
      key_talking_points?: string[];
      actionable_recommendations?: string[];
      proof_points_or_examples?: string[];
      viewer_takeaways?: string[];
      discussion_question?: string;
      script?: string;
      script_sections?: Record<string, string>;
      chapters?: Array<{ timestamp?: string; title?: string }>;
      tags: string[];
      thumbnail_text?: string;
      thumbnail_concept?: string;
      pinned_comment?: string;
      end_screen_cta?: string;
      community_post?: string;
      shorts_ideas?: string[];
      shortFormVideo?: ShortFormVideoContent;
      short_form_video?: ShortFormVideoContent;
    };
    [platform: string]: any;
  };
  instagramHtml?: string;
}
