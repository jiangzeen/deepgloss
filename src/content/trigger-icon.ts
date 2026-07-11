import translationCardStyles from '@/shared/translation-card.css?inline';
import { createTranslateTriggerButton } from '@/shared/translation-card';

/**
 * Floating trigger icon that appears near text selection.
 * Uses Shadow DOM for style isolation.
 */
export class TriggerIcon {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private iconEl: HTMLButtonElement;
  private clickCallback: (() => void) | null = null;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'deepgloss-trigger-host';
    this.host.style.cssText = 'position:fixed;z-index:2147483646;top:0;left:0;pointer-events:none;';

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = translationCardStyles;
    this.shadow.appendChild(style);

    this.iconEl = createTranslateTriggerButton(() => this.clickCallback?.());
    this.shadow.appendChild(this.iconEl);

    document.body.appendChild(this.host);
  }

  show(rect: DOMRect, onClick: () => void): void {
    this.clickCallback = onClick;

    let left = rect.left + rect.width / 2 - 14;
    let top = rect.top - 36;

    left = Math.max(4, Math.min(left, window.innerWidth - 32));
    if (top < 4) {
      top = rect.bottom + 8;
    }

    this.iconEl.style.left = `${left}px`;
    this.iconEl.style.top = `${top}px`;
    this.iconEl.classList.add('is-visible');
  }

  hide(): void {
    this.iconEl.classList.remove('is-visible');
    this.clickCallback = null;
  }

  destroy(): void {
    this.host.remove();
  }
}
