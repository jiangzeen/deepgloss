import type { TranslationSegment } from '@/providers/types';

/**
 * Render a TranslationSegment into the result container.
 * Pure DOM manipulation — no framework.
 */
export function renderTranslationResult(
  container: HTMLDivElement,
  segment: TranslationSegment,
): void {
  container.innerHTML = '';

  // Main translated text
  const textEl = document.createElement('div');
  textEl.className = 'dg-result-text';
  textEl.textContent = segment.text;
  container.appendChild(textEl);

  // Pronunciation
  if (segment.pronunciation) {
    const pronEl = document.createElement('div');
    pronEl.className = 'dg-pronunciation';
    pronEl.textContent = segment.pronunciation;
    container.appendChild(pronEl);
  }

  // Alternative translations
  if (segment.alternatives && segment.alternatives.length > 0) {
    const altContainer = document.createElement('div');
    altContainer.className = 'dg-alternatives';

    const altTitle = document.createElement('div');
    altTitle.className = 'dg-alternatives-title';
    altTitle.textContent = 'Alternatives';
    altContainer.appendChild(altTitle);

    for (const alt of segment.alternatives) {
      const altItem = document.createElement('div');
      altItem.className = 'dg-alt-item';
      altItem.textContent = alt;
      altContainer.appendChild(altItem);
    }

    container.appendChild(altContainer);
  }

  // Glosses (word-level breakdown)
  if (segment.glosses && segment.glosses.length > 0) {
    const glossContainer = document.createElement('div');
    glossContainer.className = 'dg-alternatives';

    const glossTitle = document.createElement('div');
    glossTitle.className = 'dg-alternatives-title';
    glossTitle.textContent = 'Word Breakdown';
    glossContainer.appendChild(glossTitle);

    for (const gloss of segment.glosses) {
      const glossItem = document.createElement('div');
      glossItem.className = 'dg-alt-item';
      const pos = gloss.partOfSpeech ? ` (${gloss.partOfSpeech})` : '';
      glossItem.textContent = `${gloss.source} → ${gloss.target}${pos}`;
      glossContainer.appendChild(glossItem);
    }

    container.appendChild(glossContainer);
  }
}
