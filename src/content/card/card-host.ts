import cardStyles from './card.css?inline';
import { calculateCardPosition } from './card-position';
import { renderTranslationResult } from './card-renderer';
import type { TranslationSegment } from '@/providers/types';

/**
 * Shadow DOM host for the translation card.
 * All DOM nodes are pre-created in the constructor for instant show/hide.
 */
export class CardHost {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;

  // Pre-created DOM nodes
  private container: HTMLDivElement;
  private sourceEl: HTMLDivElement;
  private loadingEl: HTMLDivElement;
  private resultEl: HTMLDivElement;
  private streamEl: HTMLDivElement;
  private errorEl: HTMLDivElement;
  private providerLabel: HTMLSpanElement;
  private copyBtn: HTMLButtonElement;
  private cardWidth: number;
  private cardTheme: string;

  constructor(cardWidth = 400, cardTheme = 'auto') {
    this.cardWidth = cardWidth;
    this.cardTheme = cardTheme;

    // Host element — stays in DOM but hidden
    this.host = document.createElement('div');
    this.host.id = 'deepgloss-card-host';
    this.host.style.cssText = 'position:fixed;z-index:2147483647;display:none;';

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // Inject styles
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

    // Source text
    this.sourceEl = this.el('div', 'dg-source');

    // Body
    const body = this.el('div', 'dg-body');
    this.loadingEl = this.el('div', 'dg-loading');
    this.loadingEl.innerHTML = '<div class="dg-spinner"></div>';
    this.resultEl = this.el('div', 'dg-result');
    this.streamEl = this.el('div', 'dg-stream');
    this.errorEl = this.el('div', 'dg-error');
    body.append(this.loadingEl, this.resultEl, this.streamEl, this.errorEl);

    // Footer
    const footer = this.el('div', 'dg-footer');
    this.providerLabel = this.el('span', '') as HTMLSpanElement;
    this.copyBtn = document.createElement('button');
    this.copyBtn.className = 'dg-copy-btn';
    this.copyBtn.textContent = 'Copy';
    this.copyBtn.addEventListener('click', () => this.copyResult());
    footer.append(this.providerLabel, this.copyBtn);

    // Assemble
    this.container.append(header, this.sourceEl, body, footer);
    this.shadow.appendChild(this.container);

    // Click outside to close
    document.addEventListener('mousedown', (e) => {
      if (this.host.style.display !== 'none' && !this.host.contains(e.target as Node)) {
        this.hide();
      }
    });

    document.body.appendChild(this.host);
  }

  show(rect: DOMRect, position: 'below' | 'sidebar', sourceText: string, providerName?: string): void {
    this.resetStates();
    this.sourceEl.textContent = sourceText.length > 200
      ? sourceText.slice(0, 200) + '...'
      : sourceText;
    this.providerLabel.textContent = providerName || '';

    const pos = calculateCardPosition(rect, this.cardWidth, position);
    this.host.style.left = `${pos.left}px`;
    this.host.style.top = `${pos.top}px`;
    this.container.style.maxHeight = `${pos.maxHeight}px`;
    this.host.style.display = 'block';
  }

  hide(): void {
    this.host.style.display = 'none';
    this.resetStates();
  }

  get isVisible(): boolean {
    return this.host.style.display !== 'none';
  }

  setLoading(loading: boolean): void {
    this.loadingEl.style.display = loading ? 'flex' : 'none';
  }

  appendStreamChunk(chunk: string): void {
    this.loadingEl.style.display = 'none';
    this.streamEl.style.display = 'block';
    this.streamEl.textContent += chunk;
  }

  finalizeStream(): void {
    // Stream is done — keep streamEl visible as the final result
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

  updateTheme(theme: string): void {
    this.cardTheme = theme;
    this.container.dataset.theme = theme;
  }

  updateWidth(width: number): void {
    this.cardWidth = width;
    this.container.style.width = `${width}px`;
  }

  private resetStates(): void {
    this.loadingEl.style.display = 'none';
    this.resultEl.style.display = 'none';
    this.resultEl.innerHTML = '';
    this.streamEl.style.display = 'none';
    this.streamEl.textContent = '';
    this.errorEl.style.display = 'none';
    this.errorEl.textContent = '';
  }

  private copyResult(): void {
    const text = this.streamEl.textContent || this.resultEl.textContent || '';
    if (text) {
      navigator.clipboard.writeText(text);
      this.copyBtn.textContent = 'Copied!';
      setTimeout(() => { this.copyBtn.textContent = 'Copy'; }, 1500);
    }
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
