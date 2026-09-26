import type { DeepReadSectionKind } from '../types';

/** Canonical order in which sections are requested and rendered. */
export const DEEP_READ_SECTION_KINDS: readonly DeepReadSectionKind[] = [
  'context',
  'usage',
  'synonym',
  'etymology',
  'mnemonic',
  'domain',
] as const;

export interface SectionDescriptor {
  /** Fallback heading (used when the model omits `title`). */
  label: string;
  /** Emoji shown before the heading. */
  icon: string;
  /** One-line instruction for the prompt. */
  instruction: string;
}

export const DEEP_READ_SECTIONS: Record<DeepReadSectionKind, SectionDescriptor> = {
  context: {
    label: '语境解读',
    icon: '📍',
    instruction: 'explain what the term means specifically in the supplied reading context',
  },
  usage: {
    label: '用法要点',
    icon: '💡',
    instruction: 'common collocations / usage patterns (3-5 short bullets)',
  },
  synonym: {
    label: '近义词辨析',
    icon: '🔗',
    instruction: '2-4 near-synonyms, each with a short discrimination note',
  },
  etymology: {
    label: '词源',
    icon: '🌱',
    instruction: 'brief and accurate etymology / word origin',
  },
  mnemonic: {
    label: '记忆口诀',
    icon: '🧠',
    instruction: 'a short, memorable mnemonic tip (playful is fine)',
  },
  domain: {
    label: '使用场景',
    icon: '📚',
    instruction: 'domains / registers where the term is commonly used',
  },
};

export function isSectionKind(value: unknown): value is DeepReadSectionKind {
  return (
    typeof value === 'string' &&
    (DEEP_READ_SECTION_KINDS as readonly string[]).includes(value)
  );
}

/** Filter + order a requested section list against the canonical kinds. */
export function resolveSections(
  requested?: DeepReadSectionKind[],
): DeepReadSectionKind[] {
  if (!requested || requested.length === 0) return [...DEEP_READ_SECTION_KINDS];
  const set = new Set(requested);
  return DEEP_READ_SECTION_KINDS.filter((kind) => set.has(kind));
}
