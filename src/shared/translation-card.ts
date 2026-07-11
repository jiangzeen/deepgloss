import type { DeepReadResult, TranslationSegment } from '@/providers/types';

export const TRANSLATE_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;

export interface CardPositionResult {
  left: number;
  top: number;
  maxHeight: number;
  width: number;
}

const CARD_MARGIN = 8;
const MIN_CARD_HEIGHT = 120;
const MAX_FLOATING_HEIGHT = 420;

export function calculateFloatingCardPosition(
  selectionRect: DOMRect,
  cardWidth: number,
  position: 'below' | 'sidebar',
): CardPositionResult {
  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const width = Math.max(220, Math.min(cardWidth, viewportWidth - CARD_MARGIN * 2));

  if (position === 'sidebar' && viewportWidth > width + CARD_MARGIN * 2) {
    return {
      left: viewportWidth - width - CARD_MARGIN * 2,
      top: CARD_MARGIN * 2,
      maxHeight: Math.max(MIN_CARD_HEIGHT, viewportHeight - CARD_MARGIN * 4),
      width,
    };
  }

  let left = selectionRect.left;
  if (left + width > viewportWidth - CARD_MARGIN) {
    left = viewportWidth - width - CARD_MARGIN;
  }
  left = Math.max(CARD_MARGIN, left);

  const spaceBelow = viewportHeight - selectionRect.bottom - CARD_MARGIN;
  const spaceAbove = selectionRect.top - CARD_MARGIN;
  const preferAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
  const available = preferAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(MIN_CARD_HEIGHT, Math.min(MAX_FLOATING_HEIGHT, available - CARD_MARGIN));
  const top = preferAbove
    ? Math.max(CARD_MARGIN, selectionRect.top - maxHeight - CARD_MARGIN)
    : Math.min(selectionRect.bottom + CARD_MARGIN, viewportHeight - MIN_CARD_HEIGHT - CARD_MARGIN);

  return { left, top, maxHeight, width };
}

export function createTranslateTriggerButton(onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dg-trigger';
  button.setAttribute('aria-label', 'Translate selected text');
  button.innerHTML = TRANSLATE_ICON_SVG;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  button.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  return button;
}

export function setElementVisible(el: HTMLElement, visible: boolean): void {
  el.classList.toggle('is-visible', visible);
}

export function setButtonSuccess(button: HTMLButtonElement, label: string, restoreLabel: string): void {
  button.textContent = label;
  button.classList.add('is-success');
  window.setTimeout(() => {
    button.textContent = restoreLabel;
    button.classList.remove('is-success');
  }, 1500);
}

export function renderTranslationResult(
  container: HTMLDivElement,
  segment: TranslationSegment,
): void {
  container.innerHTML = '';

  const textEl = document.createElement('div');
  textEl.className = 'dg-result-text';
  textEl.textContent = segment.text;
  container.appendChild(textEl);

  if (segment.pronunciation) {
    const pronEl = document.createElement('div');
    pronEl.className = 'dg-pronunciation';
    pronEl.textContent = segment.pronunciation;
    container.appendChild(pronEl);
  }

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
  speakBtn.setAttribute('aria-label', `播放 ${result.term} 的发音`);
  speakBtn.textContent = '▶';
  speakBtn.addEventListener('click', actions.onSpeak);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'dg-copy-btn';
  saveBtn.type = 'button';
  saveBtn.setAttribute('aria-label', actions.saved ? '已收藏' : '收藏到词库');
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
