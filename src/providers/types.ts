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

export interface DeepReadExample {
  source: string;
  translation?: string;
}

export interface DeepReadDefinition {
  partOfSpeech?: string;
  meaning: string;
  translation?: string;
  examples: DeepReadExample[];
}

export interface DeepReadResult {
  term: string;
  normalizedTerm: string;
  phonetic?: string;
  pronunciationLang?: string;
  partOfSpeech?: string;
  definitions: DeepReadDefinition[];
  contextualMeaning?: string;
  contextExplanation?: string;
  sourceContext?: string;
}

export interface DeepReadRequest extends TranslationRequest {
  translatedText?: string;
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

  deepRead?(req: DeepReadRequest): Promise<DeepReadResult>;

  translateStream?(
    req: TranslationRequest,
    onChunk: StreamCallback,
  ): { abort: AbortController; done: Promise<TranslationSegment> };

  validateConfig(config: ProviderConfig): Promise<{ valid: boolean; error?: string }>;

  configure(config: ProviderConfig): void;
}
