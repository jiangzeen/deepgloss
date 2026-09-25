import type {
  DeepReadDefinition,
  DeepReadFrequency,
  DeepReadMeta,
  DeepReadRequest,
  DeepReadResult,
  DeepReadSection,
  DeepReadSynonym,
} from '../types';
import { isSectionKind } from './sections';

const FREQUENCIES: readonly DeepReadFrequency[] = ['high', 'medium', 'low'];

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
  return items.length ? items : undefined;
}

function asFrequency(value: unknown): DeepReadFrequency | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  if ((FREQUENCIES as readonly string[]).includes(lower)) {
    return lower as DeepReadFrequency;
  }
  if (value.includes('高')) return 'high';
  if (value.includes('中')) return 'medium';
  if (value.includes('低')) return 'low';
  return undefined;
}

function coerceExamples(value: unknown): { source: string; translation?: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { source: string; translation?: string }[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const source = asString(item);
      if (source) out.push({ source });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const source = asString(rec.source) ?? asString(rec.en) ?? asString(rec.example);
    if (!source) continue;
    out.push({ source, translation: asString(rec.translation) ?? asString(rec.zh) });
  }
  return out;
}

function coerceDefinitions(value: unknown): DeepReadDefinition[] {
  if (!Array.isArray(value)) return [];
  const out: DeepReadDefinition[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const meaning = asString(rec.meaning) ?? asString(rec.definition) ?? asString(rec.translation);
    if (!meaning) continue;
    out.push({
      partOfSpeech: asString(rec.partOfSpeech) ?? asString(rec.pos),
      meaning,
      translation: asString(rec.translation),
      examples: coerceExamples(rec.examples),
    });
  }
  return out;
}

function coerceSynonyms(value: unknown): DeepReadSynonym[] {
  if (!Array.isArray(value)) return [];
  const out: DeepReadSynonym[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const word = asString(rec.word) ?? asString(rec.term);
    if (!word) continue;
    const note =
      asString(rec.note) ?? asString(rec.difference) ?? asString(rec.usage) ?? '';
    out.push({ word, note });
  }
  return out;
}

function coerceMeta(obj: Record<string, unknown>): DeepReadMeta {
  return {
    term: asString(obj.term),
    normalizedTerm: asString(obj.normalizedTerm),
    phonetic: asString(obj.phonetic),
    pronunciationLang: asString(obj.pronunciationLang),
    partOfSpeech: asString(obj.partOfSpeech) ?? asString(obj.pos),
    frequency: asFrequency(obj.frequency),
    primaryTranslation: asString(obj.primaryTranslation) ?? asString(obj.translation),
    alternatives: asStringArray(obj.alternatives),
    definitions: coerceDefinitions(obj.definitions),
  };
}

function coerceSection(obj: Record<string, unknown>): DeepReadSection | null {
  const kind = obj.kind;
  if (!isSectionKind(kind)) return null;

  const section: DeepReadSection = { kind };
  section.title = asString(obj.title);
  section.text =
    asString(obj.text) ?? asString(obj.content) ?? asString(obj.explanation);
  section.items = asStringArray(obj.items) ?? asStringArray(obj.points);

  const synonyms = coerceSynonyms(obj.synonyms);
  if (synonyms.length) section.synonyms = synonyms;

  if (kind === 'mnemonic') section.highlight = true;

  const hasContent =
    Boolean(section.text) ||
    Boolean(section.items?.length) ||
    Boolean(section.synonyms?.length);
  return hasContent ? section : null;
}

/** Pull a JSON object out of a (possibly noisy) line. */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  let line = raw.trim();
  if (!line) return null;
  // Strip markdown code fences and list punctuation.
  line = line.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  if (!line || line === '[' || line === ']' || line === ',') return null;
  line = line.replace(/,\s*$/, '');

  const attempt = (text: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = attempt(line);
  if (direct) return direct;

  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start >= 0 && end > start) return attempt(line.slice(start, end + 1));
  return null;
}

export interface ParsedChunk {
  meta?: DeepReadMeta;
  sections: DeepReadSection[];
}

/**
 * Incremental NDJSON parser for streamed deep reads.
 *
 * Accepts one JSON object per line. Also tolerates a pretty-printed single
 * object (via `flush()`), code fences and stray punctuation.
 */
export class DeepReadStreamParser {
  private buffer = '';
  private raw = '';
  private meta: DeepReadMeta = {};
  private sections: DeepReadSection[] = [];
  private parsedAny = false;

  push(chunk: string): ParsedChunk {
    this.raw += chunk;
    this.buffer += chunk;
    const out: ParsedChunk = { sections: [] };
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.consume(line, out);
    return out;
  }

  flush(): ParsedChunk {
    const out: ParsedChunk = { sections: [] };
    if (this.buffer.trim()) {
      this.consume(this.buffer, out);
      this.buffer = '';
    }
    if (!this.parsedAny) this.consumeWhole(out);
    return out;
  }

  getMeta(): DeepReadMeta {
    return this.meta;
  }

  getSections(): DeepReadSection[] {
    return this.sections;
  }

  toResult(req: DeepReadRequest): DeepReadResult {
    return assembleResult(this.meta, this.sections, req);
  }

  private consume(line: string, out: ParsedChunk): void {
    const obj = parseJsonObject(line);
    if (!obj) return;

    if (obj.kind === 'meta' || (!obj.kind && (obj.term || obj.normalizedTerm))) {
      this.meta = { ...this.meta, ...coerceMeta(obj) };
      this.parsedAny = true;
      out.meta = this.meta;
      return;
    }

    const section = coerceSection(obj);
    if (section) {
      this.sections.push(section);
      out.sections.push(section);
      this.parsedAny = true;
    }
  }

  private consumeWhole(out: ParsedChunk): void {
    const obj = parseJsonObject(this.raw);
    if (!obj) return;
    this.meta = { ...this.meta, ...coerceMeta(obj) };
    this.parsedAny = true;
    out.meta = this.meta;

    if (Array.isArray(obj.sections)) {
      for (const item of obj.sections) {
        if (!item || typeof item !== 'object') continue;
        const section = coerceSection(item as Record<string, unknown>);
        if (section) {
          this.sections.push(section);
          out.sections.push(section);
        }
      }
    }
  }
}

function inferSpeechLang(sourceLang: string): string | undefined {
  if (sourceLang === 'auto') return undefined;
  const base = sourceLang.toLowerCase().split('-')[0];
  if (base === 'en') return 'en-US';
  return sourceLang;
}

export function assembleResult(
  meta: DeepReadMeta,
  sections: DeepReadSection[],
  req: DeepReadRequest,
): DeepReadResult {
  const term = (meta.term || req.text).trim();
  const normalizedTerm = (meta.normalizedTerm || term).trim();
  const contextSection = sections.find(
    (section) => section.kind === 'context' && section.text,
  );

  return {
    term,
    normalizedTerm,
    phonetic: meta.phonetic,
    pronunciationLang: meta.pronunciationLang || inferSpeechLang(req.sourceLang),
    partOfSpeech: meta.partOfSpeech,
    frequency: meta.frequency,
    primaryTranslation: meta.primaryTranslation,
    alternatives: meta.alternatives,
    definitions: meta.definitions ?? [],
    contextualMeaning: contextSection?.text,
    sourceContext: req.context?.slice(0, 240),
    sections,
  };
}

/** Parse a complete (non-streamed) deep-read response. */
export function parseDeepReadResult(raw: string, req: DeepReadRequest): DeepReadResult {
  const parser = new DeepReadStreamParser();
  parser.push(raw);
  parser.flush();
  return parser.toResult(req);
}
