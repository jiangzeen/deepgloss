import type { DeepReadResult, TranslationSegment } from '@/providers/types';

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

export interface DeepReadRenderActions {
  saved: boolean;
  onSpeak: () => void;
  onSave: (button: HTMLButtonElement) => void;
}

export function renderDeepReadResult(
  container: HTMLDivElement,
  result: DeepReadResult,
  actions: DeepReadRenderActions,
): void {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'dg-deep-header';

  const titleWrap = document.createElement('div');
  const term = document.createElement('div');
  term.className = 'dg-deep-term';
  term.textContent = result.normalizedTerm || result.term;
  titleWrap.appendChild(term);

  const metaParts = [result.phonetic, result.partOfSpeech].filter(Boolean);
  if (metaParts.length > 0) {
    const meta = document.createElement('div');
    meta.className = 'dg-deep-meta';
    meta.textContent = metaParts.join(' · ');
    titleWrap.appendChild(meta);
  }

  const actionsEl = document.createElement('div');
  actionsEl.className = 'dg-deep-actions';

  const speakBtn = document.createElement('button');
  speakBtn.className = 'dg-icon-btn';
  speakBtn.type = 'button';
  speakBtn.title = '发音';
  speakBtn.textContent = '▶';
  speakBtn.addEventListener('click', actions.onSpeak);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'dg-copy-btn';
  saveBtn.type = 'button';
  saveBtn.textContent = actions.saved ? '已收藏' : '收藏';
  saveBtn.disabled = actions.saved;
  saveBtn.addEventListener('click', () => actions.onSave(saveBtn));

  actionsEl.append(speakBtn, saveBtn);
  header.append(titleWrap, actionsEl);
  container.appendChild(header);

  if (result.contextualMeaning || result.contextExplanation) {
    const context = document.createElement('div');
    context.className = 'dg-context-meaning';
    context.textContent = [result.contextualMeaning, result.contextExplanation]
      .filter(Boolean)
      .join('。');
    container.appendChild(context);
  }

  for (const definition of result.definitions.slice(0, 3)) {
    const item = document.createElement('div');
    item.className = 'dg-definition';

    const title = document.createElement('div');
    title.className = 'dg-definition-title';
    title.textContent = [definition.partOfSpeech, definition.translation]
      .filter(Boolean)
      .join(' · ') || '释义';
    item.appendChild(title);

    const meaning = document.createElement('div');
    meaning.className = 'dg-definition-meaning';
    meaning.textContent = definition.meaning;
    item.appendChild(meaning);

    for (const example of definition.examples.slice(0, 2)) {
      const exampleEl = document.createElement('div');
      exampleEl.className = 'dg-example';
      exampleEl.textContent = example.translation
        ? `${example.source} — ${example.translation}`
        : example.source;
      item.appendChild(exampleEl);
    }

    container.appendChild(item);
  }

  if (result.definitions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'dg-deep-empty';
    empty.textContent = '暂时没有可展示的结构化释义。';
    container.appendChild(empty);
  }
}
