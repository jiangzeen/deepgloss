import type {
  TranslationProvider,
  TranslationRequest,
  TranslationSegment,
  StreamCallback,
  ProviderCapabilities,
  ProviderConfig,
} from "./types";

export class OpenAICompatibleProvider implements TranslationProvider {
  readonly id = "openai-compatible";
  readonly name = "OpenAI Compatible";
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsAutoDetect: true,
    supportsGloss: true,
    supportsContext: true,
    maxTextLength: 4000,
    requiresApiKey: true,
  };

  private apiKey = "sk-5b4a5ae3643647bfb0a903a50519c5ba";
  private endpoint = "https://api.deepseek.com";
  private model = "deepseek-chat";

  configure(config: ProviderConfig): void {
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.endpoint) this.endpoint = config.endpoint;
    if (config.model) this.model = config.model;
  }

  /**
   * Normalize endpoint to full chat completions URL.
   * Accepts base URL (https://api.deepseek.com) or full path.
   */
  private getCompletionsUrl(base?: string): string {
    const url = base || this.endpoint;
    // Already a full path (contains /chat/completions)
    if (url.includes("/chat/completions")) return url;
    // Strip trailing slash and append path
    const normalized = url.replace(/\/+$/, "");
    // If ends with /v1, just append /chat/completions
    if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
    // Otherwise append /v1/chat/completions
    return `${normalized}/v1/chat/completions`;
  }

  async validateConfig(
    config: ProviderConfig,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!config.apiKey) return { valid: false, error: "API key is required" };
    try {
      const resp = await fetch(this.getCompletionsUrl(config.endpoint as string), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || this.model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
        }),
      });
      return resp.ok
        ? { valid: true }
        : { valid: false, error: `API returned ${resp.status}` };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  async translate(req: TranslationRequest): Promise<TranslationSegment> {
    const resp = await fetch(this.getCompletionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(req),
        temperature: 0.3,
      }),
    });

    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
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
