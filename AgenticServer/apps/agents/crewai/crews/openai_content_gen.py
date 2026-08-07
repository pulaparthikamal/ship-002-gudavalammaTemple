from __future__ import annotations
import os
import json
from datetime import datetime
from typing import Any
from django.conf import settings
from crewai import Agent, Task
from .base import BaseCrew
from .registry import register_crew
from ..templates import render_instagram_slides
from ..prompts import (
    RESEARCH_CLEANER_BACKSTORY,
    WRITER_BACKSTORY,
    HUMANIZER_BACKSTORY,
    PLATFORM_ADAPTER_BACKSTORY,
    FACEBOOK_STORY_STRATEGY,
    INSTAGRAM_STORY_STRATEGY,
    TWITTER_THREAD_STRATEGY,
    LINKEDIN_LONG_FORM_STRATEGY,
    YOUTUBE_SCRIPT_BACKSTORY,
    DESIGNER_BACKSTORY,
    SOCIAL_PLATFORM_TEMPLATE,
    TONE_INTENSITY_GUIDANCE,
    TECHNICAL_ANCHOR_POINT_RULE,
    COMBINED_REVIEWER_BACKSTORY,
    PROMPT_INTENT_RULE,
)
from ..utils.youtube_expander import expand_chapters_to_script
from ..creator_research import creator_research_output_instruction
from ..prompt_context import build_novelty_instructions, build_output_contract

@register_crew("openai_content")
class OpenAIContentCrew(BaseCrew):
    """
    OpenAI-Optimized Production Pipeline with Tone Intensity Layer.
    Produces structured, point-wise, hashtag-rich content for all platforms
    including a full YouTube video script for video creation.
    """
    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        # OpenAI Model Strategy
        m_heavy = self._get_llm_for_model("gpt-4o")
        m_fast = self._get_llm_for_model("gpt-4o-mini")
        
        # 1. Research Layer — selects the most important content angle
        research_analyst = Agent(
            role="Research Analyst & Topic Selector",
            goal=(
                "Deep research understanding, signal extraction, and selection of the "
                "single most important content angle for video creation about {topic}."
            ),
            backstory=RESEARCH_CLEANER_BACKSTORY,
            llm=m_heavy,
        )
        
        # 2. Writer Agent
        writer_agent = Agent(
            role="Technical Content Writer",
            goal=(
                "Generate a deep, structured, point-wise professional master article "
                "about the selected focus of {topic}. Use numbered lists, bullets, and "
                "clear section headers throughout."
            ),
            backstory=WRITER_BACKSTORY,
            llm=m_heavy,
        )

        # 2.1 Topic Validator
        topic_validator = Agent(
            role="Topic Integrity Auditor",
            goal="Ensure the generated content strictly adheres to the intended topic: {topic}.",
            backstory="You are a strict quality controller. You detect topic drift and ensure every paragraph serves the primary subject.",
            llm=m_fast,
        )

        # 2.2 Reviewer Agent (Two-Pass High Integrity)
        reviewer_agent = Agent(
            role="Technical Reviewer",
            goal="Perform a strict two-pass review for technical accuracy and metric sourcing.",
            backstory=COMBINED_REVIEWER_BACKSTORY,
            llm=m_heavy,
        )

        # 3. LinkedIn Specialist
        linkedin_strategist = Agent(
            role="LinkedIn Professional Specialist",
            goal=(
                "Generate a full structured long-form LinkedIn post with numbered key insights, "
                "problem framing, operational lesson, and professional hashtags."
            ),
            backstory=PLATFORM_ADAPTER_BACKSTORY.format(platform="LinkedIn") + 
                      "\nRULE: Lead with [ANCHOR], end with [REALISM], drop or soften [JOKE].\n" +
                      LINKEDIN_LONG_FORM_STRATEGY,
            llm=m_heavy,
        )

        # 4. Social Specialist (IG, FB)
        social_strategist = Agent(
            role="Social Media Specialist",
            goal=(
                "Generate full structured Instagram and Facebook posts with hooks, bullet key points, "
                "proper hashtags (10+ for Instagram, 5+ for Facebook), and strong CTAs."
            ),
            backstory=PLATFORM_ADAPTER_BACKSTORY.format(platform="Instagram & Facebook") +
                      "\nINSTAGRAM RULE: Lead with [JOKE], follow with [ANCHOR].\n" +
                      INSTAGRAM_STORY_STRATEGY + "\n\n" + FACEBOOK_STORY_STRATEGY,
            llm=m_fast,
        )

        # 4.1 Twitter/X Thread Specialist
        twitter_strategist = Agent(
            role="Twitter/X Thread Specialist",
            goal=(
                "Generate a complete 8-tweet numbered thread with a strong hook tweet, "
                "5 insight tweets, a takeaway tweet, and a CTA+hashtags tweet."
            ),
            backstory=(
                PLATFORM_ADAPTER_BACKSTORY.format(platform="Twitter/X") + "\n" +
                TWITTER_THREAD_STRATEGY
            ),
            llm=m_heavy,
        )

        # 5. YouTube Video Script Specialist
        youtube_specialist = Agent(
            role="YouTube Video Script Writer",
            goal=(
                "Generate a complete, camera-ready YouTube video script for the selected content focus. "
                "Include HOOK, INTRO, 5 content sections, OUTRO, chapter timestamps, SEO title, "
                "full description, and thumbnail text. Script minimum 600 words."
            ),
            backstory=YOUTUBE_SCRIPT_BACKSTORY,
            llm=m_heavy,
        )

        # 6. Humanization Lead
        humanizer = Agent(
            role="Humanization Expert",
            goal="Inject authentic pacing and less robotic cadence.",
            backstory=HUMANIZER_BACKSTORY,
            llm=m_fast,
        )

        # 7. Technical Sanitizer
        sanitizer = Agent(
            role="Technical Sanitizer",
            goal="Fast, concise cleanup and reliable JSON structural formatting.",
            backstory="You are a strict output auditor. You remove hex codes and enforce JSON schemas.",
            llm=m_fast,
        )

        # 8. Slide Designer
        designer = Agent(
            role="Instagram Slide Planner",
            goal="Plan deterministic JSON slide data. Minimum 6 slides with bullet points per slide.",
            backstory=DESIGNER_BACKSTORY,
            llm=m_fast,
        )

        # 9. Visual Validator
        visual_validator = Agent(
            role="Visual Integrity Auditor",
            goal="Perform final visual reasoning and quality validation.",
            backstory="You are a senior auditor specialized in visual reasoning and final content validation.",
            llm=m_heavy,
        )
        
        return [
            research_analyst, writer_agent, topic_validator, reviewer_agent,
            linkedin_strategist, social_strategist, twitter_strategist,
            youtube_specialist, humanizer, sanitizer, designer, visual_validator
        ]

    def expand_youtube_timeline(self, topic: str, chapters: list[dict]) -> str:
        """Expand a simple chapter list into a presenter-ready script."""
        return expand_chapters_to_script(topic, chapters)

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        (research_analyst, writer_agent, topic_validator, reviewer_agent,
         linkedin_strategist, social_strategist, twitter_strategist,
         youtube_specialist, humanizer, sanitizer, 
         designer, visual_validator) = agents
        
        research = inputs.get("research")
        request = inputs.get("request")
        tone = getattr(request, 'tone', 'Professional')
        audience = getattr(request, 'audience', 'Business and LinkedIn readers')
        creator_research = getattr(research, 'creator_research', None) if research else None
        if creator_research and audience == 'Business and LinkedIn readers':
            audience = creator_research.get('audience', audience)
        creator_research_instruction = creator_research_output_instruction(creator_research)
        topic = research.topic if research else "the specified topic"
        prompt_context = inputs.get("prompt_context", {})
        prompt_instruction = prompt_context.get("instruction", "")
        output_contract = build_output_contract(SOCIAL_PLATFORM_TEMPLATE, prompt_context)
        video_card = prompt_context.get("video_card", {})
        if video_card.get("replace_fallback"):
            short_form_requirement = (
                "CUSTOM VIDEO SCRIPT: Do not use the conventional one-minute windows. "
                f"Follow this resolved duration, timeline, and spoken-word contract exactly: {video_card}. "
                "Write complete presenter dialogue in every window; one short sentence per timestamp is insufficient."
            )
            final_video_check = (
                "  ✓ custom_video: requested platforms use the exact video_card duration and continuous timeline, "
                "with complete dialogue meeting the total and per-window spoken-word targets\n"
            )
        else:
            short_form_requirement = (
                "FALLBACK VIDEO SCRIPT: Write 170-195 complete spoken words across all seven continuous windows "
                "from 0:00 through 1:00. Every window must contain presenter-ready dialogue, not a summary sentence."
            )
            final_video_check = (
                "  ✓ fallback_video: each shortFormVideo contains 170-195 spoken words across all seven continuous "
                "windows from 0:00 through 1:00\n"
            )
        metadata = getattr(request, 'metadata', {}) or {}
        novelty_instruction, novelty_follow_through = build_novelty_instructions(metadata, audience, tone)
        title_instruction = (
            "TITLE RULE:\n"
            "Generate 5 internal title candidates. Select the strongest one as the final title. "
            "The final title must be specific to the target audience, emotionally relevant, curiosity-driven, and tied to a real business pressure. "
            "Avoid generic titles like 'Essential Guide', 'Best Practices', 'Complete Guide', or '<Topic> for <Audience>'.\n"
        )
        audience_priority = (
            f"TARGET AUDIENCE PRIORITY: Write for '{audience}'. This audience is NOT a label to mention once; "
            "it is the main filter for every content decision.\n"
            "AUDIENCE CONNECTION RULES:\n"
            "  - Translate the topic into this audience's day-to-day business reality, customer trust concerns, "
            "buying objections, operational constraints, regulatory/safety/compliance worries, and growth goals.\n"
            "  - Use examples, risks, and CTAs that only make sense for this audience; avoid generic business advice.\n"
            "  - If the topic is technical, explain why it matters in the audience's revenue, reputation, workflow, "
            "customer experience, product quality, or decision-making context.\n"
            "  - Every major section must include at least one audience-specific implication or example.\n"
            "  - Do NOT invent statistics, percentages, ROI numbers, breach rates, case studies, company stories, "
            "or regulatory claims unless they are explicitly present in the research. Use qualitative language instead.\n"
            "  - Final litmus test: if the audience phrase were removed, the content should still unmistakably feel "
            "written for that exact audience.\n"
        )

        # 1. RESEARCH + TOPIC SELECTION
        research_task = Task(
            description=(
                f"Analyze all collected research for '{topic}'.\n"
                f"{PROMPT_INTENT_RULE}\n"
                f"{prompt_instruction}\n"
                f"{audience_priority}"
                f"{novelty_instruction}"
                f"{title_instruction}"
                "STEP 1: Return [CONTENT_BRIEF] with the complete semantic interpretation of the prompt.\n"
                "STEP 2: Extract high-density technical signal without inventing current facts.\n"
                "STEP 3: Select the best organizing focus while preserving every explicit deliverable requirement.\n"
                "STEP 4: Identify 5 audience-specific pain points, objections, examples, or opportunities that connect "
                "the topic to the target audience.\n"
                "STEP 5: Label it [SELECTED_FOCUS]. It must not replace or narrow the CONTENT_BRIEF."
            ),
            expected_output=(
                "Structured [CONTENT_BRIEF], high-density research summary, and [SELECTED_FOCUS] "
                "with 3-5 bullet points explaining why this angle was selected, plus 5 audience-specific connection points."
            ),
            agent=research_analyst,
        )

        # 2. WRITING — structured, point-wise master article
        writer_task = Task(
            description=(
                f"Using the [SELECTED_FOCUS] from the research, generate a comprehensive, "
                f"structured professional master article about '{topic}' using '{tone}' tone.\n"
                f"{PROMPT_INTENT_RULE}\n"
                f"{audience_priority}"
                f"{novelty_follow_through}"
                f"{title_instruction}"
                "REQUIRED STRUCTURE:\n"
                "  1. Introduction (2-3 sentences: what and why it matters)\n"
                "  2. Key Concepts (5-7 numbered points, each 2-3 sentences)\n"
                "  3. Deep Dive (5-7 bullet points with specific technical details)\n"
                "  4. Real-World Implications (3-5 bullet points with examples)\n"
                "  5. Common Mistakes (3-5 numbered pitfalls practitioners face)\n"
                "  6. Key Takeaways (5 numbered bullets)\n"
                "Minimum 600 words. Use headers, bullets, and numbered lists throughout.\n"
                f"{TECHNICAL_ANCHOR_POINT_RULE}\n{prompt_instruction}"
            ),
            expected_output=(
                "Fully structured master article (min 600 words) with Introduction, "
                "numbered Key Concepts, bullet Deep Dive, Real-World Implications, "
                "Common Mistakes, and numbered Key Takeaways."
            ),
            agent=writer_agent,
            context=[research_task],
        )

        # 2.1 TOPIC VALIDATION
        validation_task = Task(
            description=(
                f"Does the following content match the topic: '{topic}'?\n"
                "Reply with only YES or NO and a one-sentence reason."
            ),
            expected_output="YES or NO validation result.",
            agent=topic_validator,
            context=[writer_task]
        )

        # 2.2 REVIEW
        review_task = Task(
            description=(
                "Refine the draft for technical accuracy and operational realism. "
                "Ensure that if the validation result is NO, you explicitly pivot the content "
                "back to the intended topic. Remove generic audience name-dropping and replace it with concrete "
                f"implications for '{audience}'. Remove any unsupported metrics, percentages, ROI claims, fake case studies, "
                "or fabricated company stories. Preserve all bullet points and numbered lists."
            ),
            expected_output="Polished structured professional article with all lists, sections, audience-specific examples, and unsupported metrics removed.",
            agent=reviewer_agent,
            context=[writer_task, validation_task]
        )

        # 3. LINKEDIN — full long-form structured post
        li_guidance = TONE_INTENSITY_GUIDANCE["LinkedIn"]
        linkedin_task = Task(
            description=(
                f"Generate a complete, structured long-form LinkedIn post. Tone: '{tone}'.\n"
                f"{audience_priority}"
                f"{novelty_follow_through}"
                f"{title_instruction}"
                f"Intensity: {li_guidance['intensity']}. Style: {li_guidance['style']}\n\n"
                "MANDATORY STRUCTURE:\n"
                "  - OPENING LINE: Single provocative insight (no 'excited to share')\n"
                "  - SECTION 1 — The Problem: 2-3 sentences on the real pain point\n"
                "  - SECTION 2 — Key Insights: 4-6 NUMBERED points, each 1-2 sentences, specific + actionable\n"
                "  - SECTION 3 — Deeper Implication: 2-3 sentences on what this means\n"
                "  - SECTION 4 — What I'd Do Differently: 2-3 sentences of personal operational lesson\n"
                "  - CLOSING CTA: Specific experience-based question (NOT 'What do you think?')\n"
                "  - HASHTAGS: 5-6 professional hashtags\n\n"
                "Minimum 300 words. FORMATTING: Lead with [ANCHOR], end with [REALISM].\n\n"
                f"SHORT-FORM VIDEO: Also create LinkedIn shortFormVideo. {short_form_requirement} "
                "Use a fresh central promise, hook mechanism, narrative structure, three concrete insights, surprising nuance, "
                "audience implication, specific CTA, new thumbnail metaphor, and fresh hashtag cluster based on the NOVELTY_PLAN."
                f"\n{prompt_instruction}"
            ),
            expected_output=(
                "Full structured LinkedIn post (min 300 words) with opening line, "
                "numbered Key Insights section, problem + implication + lesson sections, "
                "specific CTA, 5-6 hashtags, and a complete novel LinkedIn shortFormVideo."
            ),
            agent=linkedin_strategist,
            context=[review_task],
        )

        # 4. SOCIAL (IG/FB) — structured posts with bullets and hashtags
        ig_guidance = TONE_INTENSITY_GUIDANCE["Instagram"]
        fb_guidance = TONE_INTENSITY_GUIDANCE["Facebook"]
        social_task = Task(
            description=(
                f"Generate full structured captions for Instagram AND Facebook. Tone: '{tone}'.\n\n"
                f"{audience_priority}\n"
                f"{novelty_follow_through}"
                f"{title_instruction}"
                "=== INSTAGRAM ===\n"
                f"Intensity: {ig_guidance['intensity']} ({ig_guidance['style']})\n"
                "MANDATORY FORMAT:\n"
                "  Line 1: Punchy hook (max 10 words)\n"
                "  Lines 2-4: 3-4 value sentences with specific insight\n"
                "  Lines 5-9: 3-5 key takeaway bullets using ✦ or emoji\n"
                "  CTA: Natural specific engagement prompt\n"
                "  HASHTAGS: MINIMUM 10 hashtags — niche + broad mix\n"
                "Minimum 150 words before hashtags.\n\n"
                "=== FACEBOOK ===\n"
                f"Intensity: {fb_guidance['intensity']} ({fb_guidance['style']})\n"
                "MANDATORY FORMAT:\n"
                "  Hook: 1-2 sentence relatable scenario\n"
                "  Narrative: 2-3 human, conversational sentences\n"
                "  Key Points: 3-5 bullets using '→' arrows\n"
                "  Insight: 2-3 sentences via analogy\n"
                "  Takeaway: 1-2 quotable sentences\n"
                "  CTA: Specific experience-based prompt\n"
                "  HASHTAGS: 5-8 relevant hashtags\n"
                "Minimum 200 words.\n\n"
                "Ensure Instagram and Facebook are COMPLETELY DISTINCT — no verbatim repetition.\n\n"
                "SHORT-FORM VIDEO FOR EACH PLATFORM: Create separate Instagram and Facebook shortFormVideo objects when requested. "
                f"{short_form_requirement} Each must use a different fresh central promise, hook mechanism, "
                "narrative structure, three concrete insights, surprising nuance, audience implication, CTA, thumbnail metaphor, "
                "and hashtag cluster based on the NOVELTY_PLAN. Make them informative and shareable, never generic clickbait."
                f"\n{prompt_instruction}"
            ),
            expected_output=(
                "Instagram caption (min 150 words + 10+ hashtags) and Facebook post "
                "(min 200 words + 5+ hashtags), each fully structured with bullets, "
                "key points, distinct CTAs, and complete novel shortFormVideo objects for both platforms."
            ),
            agent=social_strategist,
            context=[review_task],
        )

        # 4.1 TWITTER/X THREAD
        tw_guidance = TONE_INTENSITY_GUIDANCE["Twitter"]
        twitter_task = Task(
            description=(
                f"Generate a complete 8-tweet numbered thread for '{topic}'. Tone: '{tone}'.\n"
                f"{audience_priority}"
                f"{novelty_follow_through}"
                f"{title_instruction}"
                f"Style: {tw_guidance['style']}\n\n"
                "MANDATORY FORMAT:\n"
                "  Tweet 1: Bold hook — shocking stat, claim, or question (max 280 chars)\n"
                "  Tweets 2-6: Numbered [X/8] insight tweets — one specific point each (max 280 chars each)\n"
                "  Tweet 7: [7/8] The single most important takeaway (max 280 chars)\n"
                "  Tweet 8: [8/8] CTA + 2-4 hashtags (max 280 chars)\n\n"
                "Also provide a standalone_post (single best tweet if thread not used).\n"
                "Each tweet MUST stand alone and make sense without context."
                f"\n{prompt_instruction}"
            ),
            expected_output=(
                "Complete 8-tweet numbered thread with hook, 5 insight tweets, "
                "takeaway tweet, CTA+hashtags tweet, and a standalone_post alternative."
            ),
            agent=twitter_strategist,
            context=[review_task],
        )

        # 5. YOUTUBE VIDEO SCRIPT
        yt_guidance = TONE_INTENSITY_GUIDANCE["YouTube"]
        youtube_task = Task(
            description=(
                f"Generate a COMPLETE, LONG-FORM, camera-ready YouTube video script for '{topic}' "
                f"using the [SELECTED_FOCUS] from research. Tone: '{tone}'.\n"
                f"{audience_priority}"
                f"{novelty_follow_through}"
                f"{title_instruction}"
                f"Style: {yt_guidance['style']}\n\n"
                "TARGET: 15-20 minute video. MINIMUM SCRIPT LENGTH: 1500 words.\n"
                "Write EVERY word the presenter will say, verbatim. NO placeholders, NO 'expand later'.\n"
                "SCRIPT FORMAT RULES:\n"
                "  - Do NOT output the script as one large paragraph.\n"
                "  - Break every section into short presenter chunks of 1-3 sentences each.\n"
                "  - Use clear markdown section headings for every marker: ## [HOOK], ## [PATTERN INTERRUPT], ## [INTRO], "
                "## [SECTION 1: Core Concept], through ## [OUTRO].\n"
                "  - Inside each section use natural side headings like 'The real problem', 'What this changes', "
                "'The practical move', or 'What to watch next'. Do not use robotic labels like Beat 1, Beat 2, "
                "Introduction:, Problem Statement:, or Unexpected Insight:.\n"
                "  - Use bullets or numbered lists only for real steps, myths, mistakes, checklists, recaps, or examples.\n"
                "  - Keep each chunk under 90 words where possible.\n"
                "  - Put production cues such as [B-ROLL SUGGESTION:], [ON-SCREEN TEXT:], [PAUSE], and [ENGAGEMENT CUE:] "
                "on their own separate lines.\n"
                "  - Also fill script_sections with the same chunked, useful shooting-script structure, not prose blocks.\n\n"
                "MANDATORY SECTIONS (write ALL fully):\n"
                "  [HOOK] (0-30s): Start mid-action with a research-supported business problem, verified claim, "
                "or concrete scenario. Do NOT invent statistics, company stories, benchmarks, outcomes, or ROI. "
                "    Do NOT say 'Hey guys' or 'Welcome back'. Min 80 words.\n"
                "  [PATTERN INTERRUPT] (30-60s): Tease the most surprising insight coming later. "
                "    [ON-SCREEN TEXT: subscribe prompt]. Min 60 words.\n"
                "  [INTRO] (60s-2min): Topic intro + credibility anchor + 'by the end of this video "
                "    you will know exactly how to...' promise. Min 150 words.\n"
                "  [SECTION 1: Core Concept] (2-4min): Define with a memorable real-world analogy. "
                "    [B-ROLL SUGGESTION: diagram]. Min 200 words.\n"
                "  [SECTION 2: Why Most People Get This Wrong] (4-6min): 3-5 named misconceptions. "
                "    Format: Belief → Why it fails → The correction. Min 200 words.\n"
                "  [SECTION 3: The Right Approach — Step by Step] (6-9min): 5+ numbered steps. "
                "    Each step: what to do + why this order matters + one pitfall. "
                "    [ON-SCREEN TEXT: step overlays]. Min 250 words.\n"
                "  [SECTION 4: Deep Technical Dive] (9-11min): Hardest/most misunderstood part. "
                "    Use specific numbers, configs, architecture decisions. "
                "    [B-ROLL SUGGESTION: screen recording]. Min 200 words.\n"
                "  [SECTION 5: Real-World Case Study] (11-13min): Specific real scenario \u2014 "
                "    what went wrong, what was tried, what finally worked. Name context. Min 200 words.\n"
                "  [SECTION 6: Advanced Tips & Optimizations] (13-15min): 3-5 pro tips most tutorials skip. "
                "    Frame as 'what I wish I knew sooner'. Min 150 words.\n"
                "  [SECTION 7: Common Mistakes & Anti-Patterns] (15-17min): 4+ specific mistakes. "
                "    Format: Mistake → Consequence → Fix. Min 150 words.\n"
                "  [OUTRO] (last 90s): Numbered recap top 5 takeaways. Subscribe CTA. Specific comment "
                "    question (NOT 'what do you think?'). Next video mention. Min 120 words.\n\n"
                "USE THESE MARKERS throughout:\n"
                "  [B-ROLL SUGGESTION: <visual>], [PAUSE], [ON-SCREEN TEXT: <text>], "
                "  [CHAPTER MARKER: <name>], [ENGAGEMENT CUE: <action>]\n\n"
                "ALSO PROVIDE:\n"
                "  - SEO title (power word + number if possible, max 70 chars)\n"
                "  - Full description (min 500 words) with these exact markdown sections: Opening Hook, "
                "    Video Angle, Target Audience, Business Summary, Why Watch Now, Business Impact & Opportunities, "
                "    What You Will Learn, Key Talking Points, Actionable Recommendations, Proof Points Or Examples, "
                "    Viewer Takeaways, Chapter-By-Chapter Content, Discussion Question, Resources Mentioned, Subscribe CTA. "
                "    Do not include unsupported numeric claims.\n"
                "  - Strategy fields: video_angle, target_audience, business_summary, why_watch_now, "
                "    business_impact_opportunities, key_talking_points, actionable_recommendations, "
                "    proof_points_or_examples, viewer_takeaways, discussion_question, shorts_ideas\n"
                "  - 10 chapter timestamps with descriptive titles\n"
                "  - 15 YouTube tags (no # prefix)\n"
                "  - Thumbnail text (3-5 words) + thumbnail visual concept description\n"
                "  - Pinned comment text (timestamps + key links + CTA)\n"
                "  - End screen CTA script (last 20 seconds)\n"
                "  - YouTube Community tab post (2-3 sentences + poll/question)"
                f"\n{prompt_instruction}"
            ),
            expected_output=(
                "Complete YouTube video script (min 1500 words) with all 10 sections fully written verbatim, "
                "production markers throughout, SEO title, full description (min 500 words), "
                "10 chapter timestamps, 15 tags, thumbnail concept, pinned comment, "
                "end screen CTA, and community post."
            ),
            agent=youtube_specialist,
            context=[review_task, research_task],
        )

        # 6. HUMANIZATION
        human_task = Task(
            description=(
                "Inject human-like friction across all platform drafts. "
                "Balance humor with technical anchor points. "
                "Ensure NO 'Maximum Mode' fatigue (joke -> insight -> realism). "
                "Preserve all bullet points, numbered lists, and structured sections. "
                f"Do NOT collapse structured content into wall-of-text paragraphs. Keep the audience '{audience}' "
                "visible through concrete pains, examples, and CTAs, not repeated labels."
            ),
            expected_output="Humanized platform narratives with all structure (bullets, numbers, sections) intact.",
            agent=humanizer,
            context=[linkedin_task, social_task, twitter_task, youtube_task],
        )

        # 7. SANITIZATION
        sanitize_task = Task(
            description=(
                "Perform fast cleanup, remove artifacts, and ensure JSON structure. "
                "CRITICAL: Verify all hashtags are present in both caption text AND their arrays. "
                "Verify Instagram has 10+ hashtags, LinkedIn 5+, Facebook 5+, Twitter 3+. "
                "Verify YouTube script is present and minimum 600 words. "
                "Verify YouTube strategy fields are present: video_angle, target_audience, business_summary, "
                "why_watch_now, business_impact_opportunities, key_talking_points, actionable_recommendations, "
                "proof_points_or_examples, viewer_takeaways, discussion_question, shorts_ideas. "
                "Verify all platforms have structured bullet/numbered content."
                f" Verify all content is tailored to the target audience: '{audience}'. "
                "Remove unsupported statistics, fabricated case studies, and generic business claims. "
                "Verify the selected focus, title, hook, examples, CTA, and key points do not repeat previous content."
                " Verify every shortFormVideo follows the active prompt contract and NOVELTY_PLAN without paraphrasing prior shorts."
                f"\n{prompt_instruction}"
            ),
            expected_output="Sanitized platform package with all structure and hashtag requirements verified.",
            agent=sanitizer,
            context=[human_task],
        )

        # 8. SLIDE PLANNING — minimum 6 slides
        design_task = Task(
            description=(
                "Plan Instagram Carousel slides. MINIMUM 6 slides required:\n"
                "  Slide 1: Title/Hook slide\n"
                "  Slides 2-5: One key point per slide with 2-3 bullet sub-points\n"
                "  Slide 6: Summary + Follow CTA with numbered takeaways\n"
                "Output structured JSON slides array. Each slide body must use bullets."
            ),
            expected_output="JSON slides array with minimum 6 slides, each with title, bullet-point body, theme, and layout.",
            agent=designer,
            context=[human_task],
        )

        # 9. FINAL VALIDATION + JSON OUTPUT
        final_task = Task(
            description=(
                "Perform final semantic audit and quality validation.\n"
                "CRITICAL CHECKS before outputting:\n"
                "  ✓ Instagram: 10+ hashtags, 150+ word caption with bullet points\n"
                "  ✓ Facebook: 5+ hashtags, 200+ word post with → bullets\n"
                "  ✓ Twitter: 8-tweet thread present, standalone_post present\n"
                "  ✓ LinkedIn: 5+ hashtags, 300+ word post with numbered insights\n"
                "  ✓ YouTube: Full script (600+ words), title, description (300+ words), 6+ chapters, 8 tags\n"
                "  ✓ YouTube strategy fields: angle, audience, business summary, impact/opportunities, recommendations, proof/examples, takeaways, discussion question, shorts ideas\n"
                "  ✓ Reddit: Title + body (250+ words) + TL;DR\n"
                "  ✓ Instagram Carousel: 6+ slides with bullet-point bodies\n"
                "  ✓ master_article: 600+ words, structured with headers, including Executive Summary, Target Audience, Business Summary, Why This Topic Matters Now, Business Impact & Opportunities, Industry Use Cases, Actionable Recommendations, Metrics To Track, Content Repurposing Ideas, and Discussion Question\n"
                f"  ✓ audience_fit: content is clearly tailored to '{audience}', including pain points, examples, buying objections, benefits, and CTA\n"
                "  ✓ no_fabrication: no unsupported statistics, fake case studies, invented company stories, or unsupported regulatory claims\n"
                "  ✓ novelty: title, selected_focus, hook, examples, CTA, key points, and hashtags are clearly different from previous content\n"
                "  ✓ selected_focus: present and descriptive\n\n"
                "  ✓ prompt_alignment: all output follows the semantic CONTENT_BRIEF and requested deliverable\n"
                f"{final_video_check}\n"
                f"{creator_research_instruction}\n\n"
                f"{output_contract}"
            ),
            expected_output=output_contract,
            agent=visual_validator,
            context=[sanitize_task, design_task],
        )

        return [
            research_task, writer_task, validation_task, review_task,
            linkedin_task, social_task, twitter_task, youtube_task,
            human_task, sanitize_task, design_task, final_task
        ]
