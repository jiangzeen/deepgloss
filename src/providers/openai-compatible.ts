import type {
  TranslationProvider,
  TranslationRequest,
  TranslationSegment,
  DeepReadRequest,
  DeepReadResult,
  DeepReadStreamHandlers,
  StreamCallback,
  ProviderCapabilities,
  ProviderConfig,
} from './types';
import {
  buildDeepReadMessages,
  DeepReadStreamParser,
  parseDeepReadResult,
  type ParsedChunk,
} from './deep-read';

export class OpenAICompatibleProvider implements TranslationProvider {
  readonly id = 'openai-compatible';
  readonly name = 'OpenAI Compatible';
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsAutoDetect: true,
    supportsGloss: true,
    supportsContext: true,
    maxTextLength: 4000,
    requiresApiKey: true,
  };

  private apiKey = '';
  private endpoint = 'https://api.deepseek.com';
  private model = 'deepseek-chat';

  configure(config: ProviderConfig): void {
    if (config.apiKey) this.apiKey = config.apiKey as string;
    if (config.endpoint) this.endpoint = config.endpoint as string;
    if (config.model) this.model = config.model as string;
  }

  /**
   * Normalize endpoint to full chat completions URL.
   * Accepts base URL (https://api.deepseek.com) or full path.
   */
  private getCompletionsUrl(base?: string): string {
    const url = base || this.endpoint;
    // Already a full path (contains /chat/completions)
    if (url.includes('/chat/completions')) return url;
    // Strip trailing slash and append path
    const normalized = url.replace(/\/+$/, '');
    // If ends with /v1, just append /chat/completions
    if (normalized.endsWith('/v1')) return `${normalized}/chat/completions`;
    // Otherwise append /v1/chat/completions
    return `${normalized}/v1/chat/completions`;
  }

  private headers(apiKey = this.apiKey): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  private assertConfigured(): void {
    if (!this.apiKey) {
      throw new Error('Deep read requires an API key for the active AI provider.');
    }
  }

  private async errorMessage(resp: Response): Promise<string> {
    let detail = '';
    try {
      const body = (await resp.json()) as {
        error?: { message?: string };
        message?: string;
      };
      detail = body.error?.message || body.message || '';
    } catch {
      // ignore body parse errors
    }
    return detail ? `API error: ${resp.status} — ${detail}` : `API error: ${resp.status}`;
  }

  async validateConfig(
    config: ProviderConfig,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!config.apiKey) return { valid: false, error: 'API key is required' };
    try {
      const resp = await fetch(
        this.getCompletionsUrl(config.endpoint as string),
        {
          method: 'POST',
          headers: this.headers(config.apiKey as string),
          body: JSON.stringify({
            model: config.model || this.model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
          }),
        },
      );
      return resp.ok
        ? { valid: true }
        : { valid: false, error: `API returned ${resp.status}` };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  // ---- Deep read ----

  async deepRead(req: DeepReadRequest): Promise<DeepReadResult> {
    this.assertConfigured();
    const resp = await fetch(this.getCompletionsUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: buildDeepReadMessages(req),
        temperature: 0.2,
      }),
    });
    if (!resp.ok) throw new Error(await this.errorMessage(resp));
    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content || '';
    return parseDeepReadResult(content, req);
  }

  deepReadStream(
    req: DeepReadRequest,
    handlers: DeepReadStreamHandlers,
  ): { abort: AbortController; done: Promise<DeepReadResult> } {
    const abort = new AbortController();
    const done = this.doDeepReadStream(req, handlers, abort);
    return { abort, done };
  }

  private async doDeepReadStream(
    req: DeepReadRequest,
    handlers: DeepReadStreamHandlers,
    abort: AbortController,
  ): Promise<DeepReadResult> {
    this.assertConfigured();

    const resp = await fetch(this.getCompletionsUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: buildDeepReadMessages(req),
        temperature: 0.2,
        stream: true,
      }),
      signal: abort.signal,
    });
    if (!resp.ok) throw new Error(await this.errorMessage(resp));

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    const parser = new DeepReadStreamParser();
    let buffer = '';
    let sectionIndex = 0;

    const emit = (chunk: ParsedChunk) => {
      if (chunk.meta) handlers.onMeta?.(chunk.meta);
      for (const section of chunk.sections) {
        handlers.onSection?.(section, sectionIndex++);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta: string = json.choices?.[0]?.delta?.content || '';
          if (delta) emit(parser.push(delta));
        } catch {
          // skip malformed SSE frames
        }
      }
    }

    emit(parser.flush());
    return parser.toResult(req);
  }

  // ---- Translation ----

  async translate(req: TranslationRequest): Promise<TranslationSegment> {
    const resp = await fetch(this.getCompletionsUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(req),
        temperature: 0.3,
      }),
    });

    if (!resp.ok) throw new Error(await this.errorMessage(resp));
    const data = await resp.json();
    const content = data.choices[0].message.content;
    return this.parseResponse(content);
  }

  translateStream(
    req: TranslationRequest,
    onChunk: StreamCallback,
  ): { abort: AbortController; done: Promise<TranslationSegment> } {
    const abortController = new AbortController();
    const done = this.doStream(req, onChunk, abortController);
    return { abort: abortController, done };
  }

  private async doStream(
    req: TranslationRequest,
    onChunk: StreamCallback,
    abort: AbortController,
  ): Promise<TranslationSegment> {
    const resp = await fetch(this.getCompletionsUrl(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(req),
        temperature: 0.3,
        stream: true,
      }),
      signal: abort.signal,
    });

    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta?.content || "";
          if (delta) {
            fullText += delta;
            onChunk(delta, false);
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    onChunk("", true);
    return { text: fullText };
  }

  private buildMessages(req: TranslationRequest) {
    const sourceLangDesc =
      req.sourceLang === "auto" ? "the detected language" : req.sourceLang;

    const systemPrompt = `You are a translation assistant. Translate the given text from ${sourceLangDesc} to ${req.targetLang}. Provide a natural, accurate translation. Output ONLY the translated text, nothing else.`;

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (req.context) {
      messages.push({
        role: "user",
        content: `Context: "${req.context.slice(0, 200)}"\n\nTranslate: "${req.text}"`,
      });
    } else {
      messages.push({
        role: "user",
        content: req.text,
      });
    }

    return messages;
  }

  private parseResponse(content: string): TranslationSegment {
    return { text: content.trim() };
  }
}
