import translationCardStyles from '@/shared/translation-card.css?inline';
import cardStyles from './card.css?inline';
import { calculateCardPosition } from './card-position';
import { renderDeepReadResult, renderTranslationResult } from './card-renderer';
import { setButtonSuccess, setElementVisible } from '@/shared/translation-card';
import type { DeepReadResult, TranslationSegment } from '@/providers/types';

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
  private deepReadEl: HTMLDivElement;
  private errorEl: HTMLDivElement;
  private providerLabel: HTMLSpanElement;
  private deepReadBtn: HTMLButtonElement;
  private copyBtn: HTMLButtonElement;
  private onDeepReadRequest: (() => void) | null = null;
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
    style.textContent = `${translationCardStyles}\n${cardStyles}`;
    this.shadow.appendChild(style);

    // Card container
    this.container = this.el('div', 'dg-card');
    this.container.style.width = `${cardWidth}px`;
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'DeepGloss translation result');
    this.container.dataset.theme = cardTheme;

    // Header
    const header = this.el('div', 'dg-header');
    const title = this.el('span', 'dg-header-title');
    title.textContent = 'DeepGloss';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dg-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close translation card');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    header.append(title, closeBtn);

    // Source text
    this.sourceEl = this.el('div', 'dg-source');

    // Body
    const body = this.el('div', 'dg-body');
    this.loadingEl = this.el('div', 'dg-loading');
    this.loadingEl.innerHTML = '<div class="dg-spinner"></div><span>正在翻译...</span>';
    this.loadingEl.setAttribute('role', 'status');
    this.loadingEl.setAttribute('aria-live', 'polite');
    this.resultEl = this.el('div', 'dg-result');
    this.streamEl = this.el('div', 'dg-stream');
    this.streamEl.setAttribute('role', 'status');
    this.streamEl.setAttribute('aria-live', 'polite');
    this.streamEl.setAttribute('aria-atomic', 'false');
    this.deepReadEl = this.el('div', 'dg-deep-read');
    this.errorEl = this.el('div', 'dg-error');
    this.errorEl.setAttribute('role', 'alert');
    body.append(this.loadingEl, this.resultEl, this.streamEl, this.deepReadEl, this.errorEl);

    // Footer
    const footer = this.el('div', 'dg-footer');
    this.providerLabel = this.el('span', 'dg-provider-label') as HTMLSpanElement;
    this.deepReadBtn = document.createElement('button');
    this.deepReadBtn.className = 'dg-action-btn';
    this.deepReadBtn.type = 'button';
    this.deepReadBtn.setAttribute('aria-label', '展开深读词卡');
    this.deepReadBtn.textContent = '深读';
    setElementVisible(this.deepReadBtn, false);
    this.deepReadBtn.addEventListener('click', () => this.onDeepReadRequest?.());
    this.copyBtn = document.createElement('button');
    this.copyBtn.className = 'dg-copy-btn';
    this.copyBtn.type = 'button';
    this.copyBtn.setAttribute('aria-label', 'Copy translation result');
    this.copyBtn.textContent = 'Copy';
    this.copyBtn.addEventListener('click', () => this.copyResult());
    const footerActions = this.el('div', 'dg-footer-actions');
    footerActions.append(this.deepReadBtn, this.copyBtn);
    footer.append(this.providerLabel, footerActions);

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
    this.container.style.width = `${pos.width}px`;
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
    setElementVisible(this.loadingEl, loading);
  }

  setDeepReadAvailable(available: boolean, onRequest: (() => void) | null): void {
    this.onDeepReadRequest = available ? onRequest : null;
    setElementVisible(this.deepReadBtn, available);
    this.deepReadBtn.disabled = false;
    this.deepReadBtn.textContent = '深读';
  }

  appendStreamChunk(chunk: string): void {
    setElementVisible(this.loadingEl, false);
    setElementVisible(this.streamEl, true);
    this.streamEl.textContent += chunk;
  }

  finalizeStream(): void {
    // Stream is done — keep streamEl visible as the final result
    this.setLoading(false);
  }

  renderResult(segment: TranslationSegment): void {
    setElementVisible(this.loadingEl, false);
    setElementVisible(this.streamEl, false);
    setElementVisible(this.resultEl, true);
    renderTranslationResult(this.resultEl, segment);
  }

  setDeepReadLoading(): void {
    this.deepReadBtn.disabled = true;
    this.deepReadBtn.textContent = '加载中';
    setElementVisible(this.deepReadEl, true);
    this.deepReadEl.innerHTML = '<div class="dg-deep-loading" role="status">正在生成深读词卡...</div>';
  }

  renderDeepRead(
    result: DeepReadResult,
    saved: boolean,
    onSpeak: () => void,
    onSave: (button: HTMLButtonElement) => void,
  ): void {
    this.deepReadBtn.disabled = false;
    this.deepReadBtn.textContent = '深读';
    setElementVisible(this.deepReadEl, true);
    renderDeepReadResult(this.deepReadEl, result, { saved, onSpeak, onSave });
  }

  showDeepReadError(message: string): void {
    this.deepReadBtn.disabled = false;
    this.deepReadBtn.textContent = '深读';
    setElementVisible(this.deepReadEl, true);
    this.deepReadEl.innerHTML = '';
    const error = this.el('div', 'dg-deep-error');
    error.textContent = message;
    this.deepReadEl.appendChild(error);
  }

  getCurrentResultText(): string {
    return this.streamEl.textContent || this.resultEl.textContent || '';
  }

  showError(message: string): void {
    setElementVisible(this.loadingEl, false);
    setElementVisible(this.streamEl, false);
    setElementVisible(this.errorEl, true);
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
    setElementVisible(this.loadingEl, false);
    setElementVisible(this.resultEl, false);
    this.resultEl.innerHTML = '';
    setElementVisible(this.streamEl, false);
    this.streamEl.textContent = '';
    setElementVisible(this.deepReadEl, false);
    this.deepReadEl.innerHTML = '';
    setElementVisible(this.errorEl, false);
    this.errorEl.textContent = '';
    this.setDeepReadAvailable(false, null);
  }

  private async copyResult(): Promise<void> {
    const text = this.streamEl.textContent || this.resultEl.textContent || '';
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setButtonSuccess(this.copyBtn, 'Copied!', 'Copy');
    } catch {
      this.copyBtn.textContent = 'Copy failed';
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
