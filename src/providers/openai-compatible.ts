import type {
  TranslationProvider,
  TranslationRequest,
  TranslationSegment,
  DeepReadRequest,
  DeepReadResult,
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

  private apiKey = "";
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
      const resp = await fetch(
        this.getCompletionsUrl(config.endpoint as string),
        {
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
        },
      );
      return resp.ok
        ? { valid: true }
        : { valid: false, error: `API returned ${resp.status}` };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  async deepRead(req: DeepReadRequest): Promise<DeepReadResult> {
    if (!this.apiKey) {
      throw new Error("Deep read requires an API key for the active AI provider.");
    }

    const resp = await fetch(this.getCompletionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.buildDeepReadMessages(req),
        temperature: 0.2,
      }),
    });

    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    return this.parseDeepReadResponse(content, req);
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

  private buildDeepReadMessages(req: DeepReadRequest) {
    const sourceLangDesc =
      req.sourceLang === "auto" ? "the detected language" : req.sourceLang;

    const schema = `{
  "term": "selected word or short phrase",
  "normalizedTerm": "dictionary headword or normalized phrase",
  "phonetic": "IPA or common phonetic spelling when available",
  "pronunciationLang": "BCP-47 language tag for speech synthesis, for example en-US",
  "partOfSpeech": "primary part of speech",
  "definitions": [
    {
      "partOfSpeech": "noun/verb/adjective/etc",
      "meaning": "standard definition in the source language or English",
      "translation": "concise explanation in the target language",
      "examples": [
        { "source": "natural example sentence", "translation": "target-language translation" }
      ]
    }
  ],
  "contextualMeaning": "meaning of the selected term in the supplied context",
  "contextExplanation": "brief target-language explanation of why this meaning fits",
  "sourceContext": "short source context excerpt"
}`;

    const userContent = [
      `Selected term: ${JSON.stringify(req.text)}`,
      `Source language: ${sourceLangDesc}`,
      `Target language for explanations: ${req.targetLang}`,
      req.translatedText ? `Existing quick translation: ${JSON.stringify(req.translatedText)}` : "",
      req.context ? `Reading context: ${JSON.stringify(req.context.slice(0, 600))}` : "",
    ].filter(Boolean).join("\n");

    return [
      {
        role: "system" as const,
        content: `You are a concise learner dictionary assistant. Return ONLY valid JSON matching this schema, with 1-3 common definitions and 1-2 examples per definition. Do not include markdown. Schema:\n${schema}`,
      },
      { role: "user" as const, content: userContent },
    ];
  }

  private parseDeepReadResponse(content: string, req: DeepReadRequest): DeepReadResult {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: Partial<DeepReadResult> = {};

    try {
      parsed = JSON.parse(cleaned) as Partial<DeepReadResult>;
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<DeepReadResult>;
      } else {
        throw new Error("Deep read response was not valid JSON.");
      }
    }

    const normalizedTerm = (parsed.normalizedTerm || parsed.term || req.text).trim();
    const definitions = Array.isArray(parsed.definitions)
      ? parsed.definitions
          .map((definition) => ({
            partOfSpeech: definition.partOfSpeech,
            meaning: definition.meaning || definition.translation || "",
            translation: definition.translation,
            examples: Array.isArray(definition.examples)
              ? definition.examples
                  .map((example) => ({
                    source: example.source || "",
                    translation: example.translation,
                  }))
                  .filter((example) => example.source)
              : [],
          }))
          .filter((definition) => definition.meaning)
      : [];

    return {
      term: (parsed.term || req.text).trim(),
      normalizedTerm,
      phonetic: parsed.phonetic,
      pronunciationLang: parsed.pronunciationLang || this.inferSpeechLang(req.sourceLang),
      partOfSpeech: parsed.partOfSpeech || definitions[0]?.partOfSpeech,
      definitions,
      contextualMeaning: parsed.contextualMeaning,
      contextExplanation: parsed.contextExplanation,
      sourceContext: parsed.sourceContext || req.context?.slice(0, 240),
    };
  }

  private inferSpeechLang(sourceLang: string): string | undefined {
    if (sourceLang === "auto") return undefined;
    const base = sourceLang.toLowerCase().split("-")[0];
    if (base === "en") return "en-US";
    return sourceLang;
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
