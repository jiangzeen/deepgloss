import cardStyles from './card.css?inline';
import { calculateCardPosition } from './card-position';
import { renderTranslationResult } from './card-renderer';
import {
  appendDeepReadSection,
  clearNode,
  renderDeepReadHeader,
} from './deep-read-renderer';
import type {
  DeepReadMeta,
  DeepReadResult,
  DeepReadSection,
  TranslationSegment,
} from '@/providers/types';

export type CardTab = 'basic' | 'deep';

function resultToMeta(result: DeepReadResult): DeepReadMeta {
  return {
    term: result.term,
    normalizedTerm: result.normalizedTerm,
    phonetic: result.phonetic,
    pronunciationLang: result.pronunciationLang,
    partOfSpeech: result.partOfSpeech,
    frequency: result.frequency,
    primaryTranslation: result.primaryTranslation,
    alternatives: result.alternatives,
    definitions: result.definitions,
  };
}

/**
 * Shadow DOM host for the translation card.
 * All fixed DOM nodes are pre-created in the constructor for instant show/hide;
 * deep-read section nodes are created on demand (infrequent, dynamic count).
 */
export class CardHost {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;

  // Shell
  private container: HTMLDivElement;
  private sourceEl: HTMLDivElement;
  private providerLabel: HTMLSpanElement;
  private copyBtn: HTMLButtonElement;
  private tabsEl: HTMLDivElement;
  private tabBasic: HTMLButtonElement;
  private tabDeep: HTMLButtonElement;

  // Basic pane
  private basicPane: HTMLDivElement;
  private loadingEl: HTMLDivElement;
  private resultEl: HTMLDivElement;
  private streamEl: HTMLDivElement;
  private errorEl: HTMLDivElement;

  // Deep-read pane
  private deepPane: HTMLDivElement;
  private deepLoadingEl: HTMLDivElement;
  private deepHeadEl: HTMLDivElement;
  private deepSectionsEl: HTMLDivElement;
  private deepErrorEl: HTMLDivElement;

  // State
  private activeTab: CardTab = 'basic';
  private deepReadAvailable = false;
  private deepRequested = false;
  private onDeepReadRequest: (() => void) | null = null;
  private onDeepSave: ((button: HTMLButtonElement) => void) | null = null;
  private deepSpeak: (() => void) | null = null;
  private deepSaved = false;
  private deepMeta: DeepReadMeta | null = null;

  private cardWidth: number;
  private cardTheme: string;
  private anchorRect: DOMRect | null = null;
  private anchorPositionKind: 'below' | 'sidebar' = 'below';
  private anchorScroll = { x: 0, y: 0 };
  private repositionRaf = 0;

  constructor(cardWidth = 400, cardTheme = 'auto') {
    this.cardWidth = cardWidth;
    this.cardTheme = cardTheme;

    // Host element — stays in DOM but hidden
    this.host = document.createElement('div');
    this.host.id = 'deepgloss-card-host';
    this.host.style.cssText = 'position:fixed;z-index:2147483647;display:none;';

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = cardStyles;
    this.shadow.appendChild(style);

    // Card container
    this.container = this.el('div', 'dg-card');
    this.container.style.width = `${cardWidth}px`;
    this.container.dataset.theme = cardTheme;

    // Header
    const header = this.el('div', 'dg-header');
    const title = this.el('span', 'dg-header-title');
    title.textContent = 'DeepGloss';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dg-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    header.append(title, closeBtn);

    // Tabs
    this.tabsEl = this.el('div', 'dg-tabs');
    this.tabsEl.style.display = 'none';
    this.tabBasic = this.makeTab('基础翻译', () => this.setActiveTab('basic'));
    this.tabDeep = this.makeTab('AI 深读', () => this.onDeepTabClick());
    this.tabDeep.style.display = 'none';
    this.tabsEl.append(this.tabBasic, this.tabDeep);

    // Source text
    this.sourceEl = this.el('div', 'dg-source');

    // Body
    const body = this.el('div', 'dg-body');

    this.basicPane = this.el('div', 'dg-pane dg-pane-basic');
    this.loadingEl = this.el('div', 'dg-loading');
    this.loadingEl.innerHTML = '<div class="dg-spinner"></div>';
    this.resultEl = this.el('div', 'dg-result');
    this.streamEl = this.el('div', 'dg-stream');
    this.errorEl = this.el('div', 'dg-error');
    this.basicPane.append(this.loadingEl, this.resultEl, this.streamEl, this.errorEl);

    this.deepPane = this.el('div', 'dg-pane dg-pane-deep');
    this.deepLoadingEl = this.el('div', 'dg-deep-loading');
    this.deepHeadEl = this.el('div', 'dg-deep-head-wrap');
    this.deepSectionsEl = this.el('div', 'dg-deep-sections');
    this.deepErrorEl = this.el('div', 'dg-deep-error');
    this.deepPane.append(
      this.deepLoadingEl,
      this.deepHeadEl,
      this.deepSectionsEl,
      this.deepErrorEl,
    );

    body.append(this.basicPane, this.deepPane);

    // Footer
    const footer = this.el('div', 'dg-footer');
    this.providerLabel = this.el('span', '') as HTMLSpanElement;
    this.copyBtn = document.createElement('button');
    this.copyBtn.className = 'dg-copy-btn';
    this.copyBtn.textContent = 'Copy';
    this.copyBtn.addEventListener('click', () => this.copyResult());
    footer.append(this.providerLabel, this.copyBtn);

    // Assemble
    this.container.append(header, this.tabsEl, this.sourceEl, body, footer);
    this.shadow.appendChild(this.container);

    // Click outside to close
    document.addEventListener('mousedown', (e) => {
      if (this.host.style.display !== 'none' && !this.host.contains(e.target as Node)) {
        this.hide();
      }
    });

    // Keep the card anchored to the selection when the page scrolls/resizes.
    const onViewportChange = () => this.scheduleReposition();
    window.addEventListener('scroll', onViewportChange, { passive: true, capture: true });
    window.addEventListener('resize', onViewportChange, { passive: true });

    // Escape closes the card.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) this.hide();
    });

    document.body.appendChild(this.host);
  }

  // ---- Visibility ----

  show(rect: DOMRect, position: 'below' | 'sidebar', sourceText: string, providerName?: string): void {
    this.resetStates();
    this.sourceEl.textContent = sourceText.length > 200
      ? sourceText.slice(0, 200) + '...'
      : sourceText;
    this.providerLabel.textContent = providerName || '';

    this.anchorRect = rect;
    this.anchorPositionKind = position;
    this.anchorScroll = { x: window.scrollX, y: window.scrollY };

    this.host.style.display = 'block';
    this.applyPosition(rect, position);
  }

  hide(): void {
    this.host.style.display = 'none';
    this.anchorRect = null;
    this.resetStates();
  }

  get isVisible(): boolean {
    return this.host.style.display !== 'none';
  }

  // ---- Tabs ----

  setActiveTab(tab: CardTab): void {
    this.activeTab = tab;
    this.basicPane.style.display = tab === 'basic' ? 'block' : 'none';
    this.deepPane.style.display = tab === 'deep' ? 'block' : 'none';
    this.tabBasic.classList.toggle('dg-tab--active', tab === 'basic');
    this.tabDeep.classList.toggle('dg-tab--active', tab === 'deep');
  }

  private onDeepTabClick(): void {
    this.setActiveTab('deep');
    if (!this.deepRequested && this.onDeepReadRequest) {
      this.deepRequested = true;
      this.onDeepReadRequest();
    }
  }

  // ---- Basic translation ----

  setLoading(loading: boolean): void {
    this.loadingEl.style.display = loading ? 'flex' : 'none';
  }

  appendStreamChunk(chunk: string): void {
    this.loadingEl.style.display = 'none';
    this.streamEl.style.display = 'block';
    this.streamEl.textContent += chunk;
  }

  finalizeStream(): void {
    this.setLoading(false);
  }

  renderResult(segment: TranslationSegment): void {
    this.loadingEl.style.display = 'none';
    this.streamEl.style.display = 'none';
    this.resultEl.style.display = 'block';
    renderTranslationResult(this.resultEl, segment);
  }

  showError(message: string): void {
    this.loadingEl.style.display = 'none';
    this.streamEl.style.display = 'none';
    this.errorEl.style.display = 'block';
    this.errorEl.textContent = message;
  }

  getCurrentResultText(): string {
    return this.streamEl.textContent || this.resultEl.textContent || '';
  }

  // ---- Deep read ----

  /**
   * Enable/disable the deep-read tab. `onRequest` is invoked (once) the first
   * time the user opens the tab.
   */
  setDeepReadAvailable(available: boolean, onRequest: (() => void) | null): void {
    this.deepReadAvailable = available;
    this.onDeepReadRequest = available ? onRequest : null;
    this.tabsEl.style.display = available ? 'flex' : 'none';
    this.tabDeep.style.display = available ? 'inline-flex' : 'none';
    if (!available) this.setActiveTab('basic');
  }

  /** Switch to the deep-read tab and show the skeleton loader. */
  beginDeepRead(): void {
    this.deepRequested = true;
    this.setActiveTab('deep');
    this.deepErrorEl.style.display = 'none';
    clearNode(this.deepHeadEl);
    clearNode(this.deepSectionsEl);
    this.deepSaved = false;
    this.onDeepSave = null;
    this.deepMeta = null;
    this.deepLoadingEl.style.display = 'block';
    this.deepLoadingEl.textContent = '正在生成深读词卡...';
  }

  setDeepReadMeta(meta: DeepReadMeta, onSpeak: () => void): void {
    this.deepLoadingEl.style.display = 'none';
    this.deepMeta = meta;
    this.deepSpeak = onSpeak;
    this.refreshDeepHeader(meta);
  }

  appendDeepReadSection(section: DeepReadSection, index: number): void {
    this.deepLoadingEl.style.display = 'none';
    appendDeepReadSection(this.deepSectionsEl, section, index);
  }

  completeDeepRead(
    result: DeepReadResult,
    saved: boolean,
    onSave: (button: HTMLButtonElement) => void,
    onSpeak: () => void,
  ): void {
    this.deepLoadingEl.style.display = 'none';
    this.deepSaved = saved;
    this.onDeepSave = onSave;
    this.deepSpeak = onSpeak;
    this.deepMeta = resultToMeta(result);
    this.refreshDeepHeader(this.deepMeta);
  }

  showDeepReadError(message: string): void {
    this.deepLoadingEl.style.display = 'none';
    this.deepErrorEl.style.display = 'block';
    this.deepErrorEl.textContent = message;
  }

  private refreshDeepHeader(meta: DeepReadMeta): void {
    renderDeepReadHeader(this.deepHeadEl, meta, {
      saved: this.deepSaved,
      saveEnabled: Boolean(this.onDeepSave),
      onSpeak: this.deepSpeak ?? undefined,
      onSave: this.onDeepSave ?? undefined,
    });
  }

  // ---- Settings ----

  updateTheme(theme: string): void {
    this.cardTheme = theme;
    this.container.dataset.theme = theme;
  }

  updateWidth(width: number): void {
    this.cardWidth = width;
    this.container.style.width = `${width}px`;
    this.scheduleReposition();
  }

  // ---- Positioning ----

  private applyPosition(rect: DOMRect, position: 'below' | 'sidebar'): void {
    const pos = calculateCardPosition(rect, this.cardWidth, position);
    this.host.style.left = `${pos.left}px`;
    this.host.style.top = `${pos.top}px`;
    this.host.style.transform = pos.placement === 'above' ? 'translateY(-100%)' : 'none';
    this.container.style.maxHeight = `${pos.maxHeight}px`;
  }

  private scheduleReposition(): void {
    if (this.repositionRaf || !this.isVisible || !this.anchorRect) return;
    this.repositionRaf = requestAnimationFrame(() => {
      this.repositionRaf = 0;
      this.reposition();
    });
  }

  private reposition(): void {
    if (!this.anchorRect || this.host.style.display === 'none') return;
    const dx = window.scrollX - this.anchorScroll.x;
    const dy = window.scrollY - this.anchorScroll.y;
    const rect = new DOMRect(
      this.anchorRect.left - dx,
      this.anchorRect.top - dy,
      this.anchorRect.width,
      this.anchorRect.height,
    );
    this.applyPosition(rect, this.anchorPositionKind);
  }

  // ---- Internals ----

  private resetStates(): void {
    this.setActiveTab('basic');

    this.loadingEl.style.display = 'none';
    this.resultEl.style.display = 'none';
    this.resultEl.innerHTML = '';
    this.streamEl.style.display = 'none';
    this.streamEl.textContent = '';
    this.errorEl.style.display = 'none';
    this.errorEl.textContent = '';

    this.deepLoadingEl.style.display = 'none';
    this.deepHeadEl.innerHTML = '';
    this.deepSectionsEl.innerHTML = '';
    this.deepErrorEl.style.display = 'none';
    this.deepErrorEl.textContent = '';

    this.deepRequested = false;
    this.deepSaved = false;
    this.onDeepSave = null;
    this.deepSpeak = null;
    this.deepMeta = null;

    this.setDeepReadAvailable(false, null);
  }

  private copyResult(): void {
    const text =
      this.getCurrentResultText() ||
      this.deepSectionsEl.textContent ||
      '';
    if (text) {
      navigator.clipboard.writeText(text);
      this.copyBtn.textContent = 'Copied!';
      setTimeout(() => { this.copyBtn.textContent = 'Copy'; }, 1500);
    }
  }

  private makeTab(label: string, onClick: () => void): HTMLButtonElement {
    const tab = document.createElement('button');
    tab.className = 'dg-tab';
    tab.type = 'button';
    tab.textContent = label;
    tab.addEventListener('click', onClick);
    return tab;
  }

  private el(tag: string, className: string): HTMLDivElement {
    const el = document.createElement(tag) as HTMLDivElement;
    if (className) el.className = className;
    return el;
  }

  destroy(): void {
    this.host.remove();
  }
}
