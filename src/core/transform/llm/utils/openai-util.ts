import OpenAI from 'openai';

export interface OpenAIRequestConfig {
  prompt: string;
  payload: any;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  user?: string;
}

export class OpenAIUtil {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Calls OpenAI's chat completion endpoint with given config.
   * All config (prompt, temperature, etc.) must be passed in.
   * Logs debug info and returns both result and debug info.
   */
  async chatCompletion(config: OpenAIRequestConfig): Promise<string> {
    try {
      console.debug('[OpenAIUtil] Request:', config);
      const response = await this.openai.chat.completions.create({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: config.prompt },
          {
            role: 'user',
            content: `Here is my behavioural snapshot JSON:\n\n${JSON.stringify(config.payload)}`,
          },
        ],
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        top_p: config.top_p,
        frequency_penalty: config.frequency_penalty,
        presence_penalty: config.presence_penalty,
        stop: config.stop,
        user: config.user,
      });
      const raw = response.choices[0].message.content ?? '{}';
      return raw;
    } catch (error) {
      console.error('[OpenAIUtil] Error:', error);
      throw error;
    }
  }
}


// USAGE EXAMPLE (in transformer):
// const openai = new OpenAIUtil(process.env.OPENAI_API_KEY);
// const result = await openai.chatCompletion({ prompt, temperature, max_tokens, ... });
