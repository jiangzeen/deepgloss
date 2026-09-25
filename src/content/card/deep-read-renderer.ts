import type {
  DeepReadFrequency,
  DeepReadMeta,
  DeepReadSection,
  DeepReadSectionKind,
} from '@/providers/types';
import { DEEP_READ_SECTIONS } from '@/providers/deep-read/sections';

export interface DeepReadHeaderActions {
  saved: boolean;
  saveEnabled: boolean;
  onSpeak?: () => void;
  onSave?: (button: HTMLButtonElement) => void;
}

const FREQUENCY_LABEL: Record<DeepReadFrequency, string> = {
  high: '高频',
  medium: '中频',
  low: '低频',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function clearNode(node: HTMLElement): void {
  node.textContent = '';
}

/** Render the card header (term, badges, phonetic, actions). */
export function renderDeepReadHeader(
  container: HTMLElement,
  meta: DeepReadMeta,
  actions: DeepReadHeaderActions,
): void {
  clearNode(container);

  const head = el('div', 'dg-deep-head');

  // Title row: term + frequency badge
  const titleRow = el('div', 'dg-deep-title-row');
  const term = el('span', 'dg-deep-term');
  term.textContent = meta.normalizedTerm || meta.term || '';
  titleRow.appendChild(term);

  if (meta.frequency) {
    const freq = el('span', `dg-freq dg-freq--${meta.frequency}`);
    freq.textContent = FREQUENCY_LABEL[meta.frequency];
    titleRow.appendChild(freq);
  }
  head.appendChild(titleRow);

  // Sub row: phonetic + POS + actions
  const subRow = el('div', 'dg-deep-sub');
  const subLeft = el('div', 'dg-deep-sub-left');

  if (meta.phonetic) {
    const phon = el('span', 'dg-deep-phon');
    phon.textContent = meta.phonetic;
    subLeft.appendChild(phon);

    if (actions.onSpeak) {
      const speak = el('button', 'dg-icon-btn');
      speak.type = 'button';
      speak.title = '发音';
      speak.textContent = '🔊';
      speak.addEventListener('click', () => actions.onSpeak?.());
      subLeft.appendChild(speak);
    }
  }

  if (meta.partOfSpeech) {
    const pos = el('span', 'dg-pos');
    pos.textContent = meta.partOfSpeech;
    subLeft.appendChild(pos);
  }
  subRow.appendChild(subLeft);

  const actionsEl = el('div', 'dg-deep-actions');
  if (actions.onSave) {
    const save = el('button', 'dg-copy-btn');
    save.type = 'button';
    save.textContent = actions.saved ? '已收藏' : '收藏';
    save.disabled = !actions.saveEnabled || actions.saved;
    save.addEventListener('click', () => actions.onSave?.(save));
    actionsEl.appendChild(save);
  }
  subRow.appendChild(actionsEl);
  head.appendChild(subRow);

  if (meta.primaryTranslation) {
    const gloss = el('div', 'dg-deep-gloss');
    gloss.textContent = meta.primaryTranslation;
    head.appendChild(gloss);
  }

  container.appendChild(head);
}

function renderSectionBody(section: DeepReadSection): HTMLElement {
  const body = el('div', 'dg-section-body');

  if (section.text) {
    const p = el('p', 'dg-section-text');
    p.textContent = section.text;
    body.appendChild(p);
  }

  if (section.items?.length) {
    const ul = el('ul', 'dg-section-list');
    for (const item of section.items) {
      const li = el('li');
      li.textContent = item;
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }

  if (section.synonyms?.length) {
    const list = el('div', 'dg-synonyms');
    for (const syn of section.synonyms) {
      const row = el('div', 'dg-synonym');
      const word = el('span', 'dg-synonym-word');
      word.textContent = syn.word;
      const note = el('span', 'dg-synonym-note');
      note.textContent = syn.note ? `— ${syn.note}` : '';
      row.append(word, note);
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  return body;
}

/** Append a single section, animating it in with a stagger. */
export function appendDeepReadSection(
  container: HTMLElement,
  section: DeepReadSection,
  index: number,
): void {
  const descriptor = DEEP_READ_SECTIONS[section.kind as DeepReadSectionKind];

  const wrapper = el('div', 'dg-section');
  if (section.highlight || section.kind === 'mnemonic') {
    wrapper.classList.add('dg-section--highlight');
  }
  wrapper.style.animationDelay = `${Math.min(index, 8) * 60}ms`;

  const head = el('div', 'dg-section-head');
  const icon = el('span', 'dg-section-icon');
  icon.textContent = descriptor?.icon ?? '•';
  const label = el('span', 'dg-section-label');
  label.textContent = section.title || descriptor?.label || section.kind;
  head.append(icon, label);
  wrapper.appendChild(head);

  wrapper.appendChild(renderSectionBody(section));
  container.appendChild(wrapper);
}
