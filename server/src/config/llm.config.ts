import env from 'env-var';
// Ensure dotenv has been loaded (env.config.ts calls dotenv.config() on import).
import './env.config';

export interface LlmConfig {
  provider: 'openai' | 'ollama';
  model: string;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export const llmConfig: LlmConfig = {
  provider: env.get('LLM_PROVIDER').default('ollama').asEnum(['openai', 'ollama']) as 'openai' | 'ollama',
  model: env.get('LLM_MODEL').default('gpt-oss:120b-cloud').asString(),
  apiKey: env.get('LLM_API_KEY').default('').asString(),
  baseUrl: env.get('LLM_BASE_URL').default('http://127.0.0.1:11434').asString(),
  timeoutMs: env.get('LLM_TIMEOUT_MS').default(300000).asIntPositive(),
};
