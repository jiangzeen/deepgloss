/** A single translation result */
export interface TranslationSegment {
  text: string;
  detectedLang?: string;
  pronunciation?: string;
  alternatives?: string[];
  glosses?: GlossEntry[];
}

export interface GlossEntry {
  source: string;
  target: string;
  partOfSpeech?: string;
}

/** Streaming callback */
export type StreamCallback = (chunk: string, done: boolean) => void;

/** Translation request */
export interface TranslationRequest {
  text: string;
  sourceLang: string | 'auto';
  targetLang: string;
  context?: string;
}

/** Provider capabilities for UI adaptation */
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsAutoDetect: boolean;
  supportsGloss: boolean;
  supportsContext: boolean;
  maxTextLength: number;
  requiresApiKey: boolean;
}

/** Provider configuration */
export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  [key: string]: unknown;
}

/** Core translation provider interface */
export interface TranslationProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  translate(req: TranslationRequest): Promise<TranslationSegment>;

  translateStream?(
    req: TranslationRequest,
    onChunk: StreamCallback,
  ): { abort: AbortController; done: Promise<TranslationSegment> };

  validateConfig(config: ProviderConfig): Promise<{ valid: boolean; error?: string }>;

  configure(config: ProviderConfig): void;
}
