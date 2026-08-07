import { AppError } from '../../../utils/error.util';
import { logger } from '../../../utils/logger.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export type ClaimDenialRiskLevel = 'Low' | 'Medium' | 'High';

export type ClaimDenialPredictionPayload = {
  patientDetails?: Record<string, unknown>;
  providerDetails?: Record<string, unknown>;
  insuranceDetails?: Record<string, unknown>;
  cptCodes?: string[];
  icdCodes?: string[];
  modifiers?: string[];
  authorizationInfo?: Record<string, unknown>;
  claimAmount?: string | number;
  dateOfService?: string;
  demographics?: Record<string, unknown>;
  claimNotes?: string;
};

export type ClaimDenialPredictionResult = {
  denialProbability: number;
  riskScore: number;
  riskLevel: ClaimDenialRiskLevel;
  predictedDenialReasons: string[];
  recommendations: string[];
  confidenceLevel: number;
  summary: string;
};

type OpenAiPredictionResponse = {
  denialProbability?: number;
  riskScore?: number;
  riskLevel?: string;
  predictedDenialReasons?: string[];
  recommendations?: string[];
  confidenceLevel?: number;
  summary?: string;
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 45_000;

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY || '';
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(clamp(value <= 1 ? value * 100 : value));
}

function buildRiskLevel(score: number): ClaimDenialRiskLevel {
  if (score >= 70) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseJsonObject(value: string): OpenAiPredictionResponse {
  try {
    return JSON.parse(value);
  } catch (error) {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) {
      throw error;
    }

    return JSON.parse(match[0]);
  }
}

function buildPrompt(payload: ClaimDenialPredictionPayload) {
  return [
    'Analyze this healthcare claim before submission and predict payer denial risk.',
    'Return only valid JSON with these exact keys:',
    'denialProbability, riskScore, riskLevel, predictedDenialReasons, recommendations, confidenceLevel, summary.',
    'Use 0-100 integer percentages for denialProbability, riskScore, and confidenceLevel.',
    'riskLevel must be Low, Medium, or High.',
    'Focus on missing authorization, eligibility, demographics, coding/modifier mismatch, medical necessity, timely filing, duplicate/corrected claim risk, provider/payer setup, and documentation gaps.',
    JSON.stringify(payload),
  ].join('\n');
}

export class ClaimDenialPredictionService {
  async predict(payload: ClaimDenialPredictionPayload): Promise<ClaimDenialPredictionResult> {
    const apiKey = getOpenAiApiKey();

    if (!apiKey) {
      throw new AppError('OpenAI API key is not configured.', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are a cautious RCM claim scrubber. Give practical denial-risk signals for pre-submission review. Do not invent patient facts.',
            },
            {
              role: 'user',
              content: buildPrompt(payload),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`OpenAI denial prediction failed: ${response.status} ${errorText}`);
        throw new AppError('Unable to predict claim denial risk right now.', HTTP_STATUS.BAD_GATEWAY);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new AppError('OpenAI denial prediction response was empty.', HTTP_STATUS.BAD_GATEWAY);
      }

      const parsed = parseJsonObject(content);
      const denialProbability = toPercent(parsed.denialProbability);
      const riskScore = toPercent(parsed.riskScore, denialProbability);
      const riskLevel = ['Low', 'Medium', 'High'].includes(String(parsed.riskLevel))
        ? parsed.riskLevel as ClaimDenialRiskLevel
        : buildRiskLevel(riskScore);

      return {
        denialProbability,
        riskScore,
        riskLevel,
        predictedDenialReasons: normalizeStringArray(parsed.predictedDenialReasons, ['No specific denial reason was returned.']),
        recommendations: normalizeStringArray(parsed.recommendations, ['Review claim demographics, coding, eligibility, and authorization before submission.']),
        confidenceLevel: toPercent(parsed.confidenceLevel, 60),
        summary: typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : 'AI denial risk prediction completed.',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error(error);
      throw new AppError('Unable to predict claim denial risk right now.', HTTP_STATUS.BAD_GATEWAY);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const claimDenialPredictionService = new ClaimDenialPredictionService();
