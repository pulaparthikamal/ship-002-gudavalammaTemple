import axios from 'axios';
import { llmConfig } from '../../config/llm.config';
import { Settings } from '../../modules/settings/settings.model';

export interface GenerateTextOptions {
  systemPrompt?: string;
  temperature?: number;
}

type LlmProvider = 'openai' | 'ollama';

/**
 * Resolve the effective provider/model, preferring a runtime override
 * stored in the generic Settings collection (group: 'llm', keys
 * 'llm.provider' / 'llm.model'), falling back to env-derived llmConfig
 * when no override row exists.
 */
const resolveProviderAndModel = async (): Promise<{ provider: LlmProvider; model: string }> => {
  try {
    const [providerSetting, modelSetting] = await Promise.all([
      Settings.findOne({ key: 'llm.provider' }),
      Settings.findOne({ key: 'llm.model' }),
    ]);

    const provider = (providerSetting?.value as unknown as LlmProvider) || llmConfig.provider;
    const model = (modelSetting?.value as unknown as string) || llmConfig.model;
    return { provider, model };
  } catch {
    // Settings lookup failing (e.g. DB not reachable) should not block
    // callers — fall back to the static env-derived config.
    return { provider: llmConfig.provider, model: llmConfig.model };
  }
};

const generateText = async (prompt: string, opts?: GenerateTextOptions): Promise<string> => {
  const { provider, model } = await resolveProviderAndModel();

  const messages = [
    ...(opts?.systemPrompt ? [{ role: 'system', content: opts.systemPrompt }] : []),
    { role: 'user', content: prompt },
  ];

  if (provider === 'ollama') {
    const response = await axios.post(
      `${llmConfig.baseUrl}/api/chat`,
      {
        model,
        messages,
        stream: false,
        ...(opts?.temperature !== undefined ? { options: { temperature: opts.temperature } } : {}),
      },
      { timeout: llmConfig.timeoutMs }
    );
    return response.data?.message?.content ?? '';
  }

  // openai (or an openai-compatible endpoint, when LLM_BASE_URL is configured for it)
  const baseUrl =
    llmConfig.provider === 'openai' && llmConfig.baseUrl
      ? llmConfig.baseUrl
      : 'https://api.openai.com/v1';

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages,
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
    {
      timeout: llmConfig.timeoutMs,
      headers: { Authorization: `Bearer ${llmConfig.apiKey}` },
    }
  );
  return response.data?.choices?.[0]?.message?.content ?? '';
};

export const llmService = { generateText };
