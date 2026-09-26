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

/** Rich "deep read" blocks rendered in the AI tab. */
export type DeepReadSectionKind =
  | 'context'
  | 'usage'
  | 'synonym'
  | 'etymology'
  | 'mnemonic'
  | 'domain';

export interface DeepReadSynonym {
  word: string;
  note: string;
}

/**
 * A single deep-read block. Rendered generically, so providers can emit any
 * subset of kinds and unknown kinds are ignored by the renderer.
 */
export interface DeepReadSection {
  kind: DeepReadSectionKind;
  /** Section heading in the target language (renderer supplies a fallback). */
  title?: string;
  /** Prose content (context / etymology / mnemonic / domain). */
  text?: string;
  /** Bullet items (usage). */
  items?: string[];
  /** Synonym discrimination pairs. */
  synonyms?: DeepReadSynonym[];
  /** Render with emphasis (memory tip). */
  highlight?: boolean;
}

export type DeepReadFrequency = 'high' | 'medium' | 'low';

/** Metadata head of a deep-read result. */
export interface DeepReadMeta {
  term?: string;
  normalizedTerm?: string;
  phonetic?: string;
  pronunciationLang?: string;
  partOfSpeech?: string;
  frequency?: DeepReadFrequency;
  primaryTranslation?: string;
  alternatives?: string[];
  definitions?: DeepReadDefinition[];
}

export interface DeepReadResult {
  term: string;
  normalizedTerm: string;
  phonetic?: string;
  pronunciationLang?: string;
  partOfSpeech?: string;
  frequency?: DeepReadFrequency;
  /** Quick gloss shown in the header. */
  primaryTranslation?: string;
  alternatives?: string[];
  definitions: DeepReadDefinition[];
  contextualMeaning?: string;
  contextExplanation?: string;
  sourceContext?: string;
  /** Data-driven rich blocks. */
  sections: DeepReadSection[];
  /** Provenance. */
  providerId?: string;
  model?: string;
  generatedAt?: number;
}

export interface DeepReadRequest extends TranslationRequest {
  translatedText?: string;
  /** Section kinds to request. Defaults to all supported kinds. */
  sections?: DeepReadSectionKind[];
}

/** Called as a streamed deep read progresses. */
export interface DeepReadStreamHandlers {
  onMeta?: (meta: DeepReadMeta) => void;
  onSection?: (section: DeepReadSection, index: number) => void;
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

  deepReadStream?(
    req: DeepReadRequest,
    handlers: DeepReadStreamHandlers,
  ): { abort: AbortController; done: Promise<DeepReadResult> };

  translateStream?(
    req: TranslationRequest,
    onChunk: StreamCallback,
  ): { abort: AbortController; done: Promise<TranslationSegment> };

  validateConfig(config: ProviderConfig): Promise<{ valid: boolean; error?: string }>;

  configure(config: ProviderConfig): void;
}
