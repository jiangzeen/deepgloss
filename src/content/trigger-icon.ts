import triggerStyles from './trigger-icon.css?inline';

const TRANSLATE_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
</svg>`;

/**
 * Floating trigger icon that appears near text selection.
 * Uses Shadow DOM for style isolation.
 */
export class TriggerIcon {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private iconEl: HTMLDivElement;
  private clickCallback: (() => void) | null = null;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'deepgloss-trigger-host';
    this.host.style.cssText = 'position:fixed;z-index:2147483646;top:0;left:0;pointer-events:none;';

    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = triggerStyles;
    this.shadow.appendChild(style);

    this.iconEl = document.createElement('div');
    this.iconEl.className = 'dg-trigger';
    this.iconEl.innerHTML = TRANSLATE_ICON_SVG;
    this.iconEl.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.clickCallback?.();
    });
    // Prevent mouseup on icon from clearing selection
    this.iconEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.shadow.appendChild(this.iconEl);

    document.body.appendChild(this.host);
  }

  show(rect: DOMRect, onClick: () => void): void {
    this.clickCallback = onClick;

    // Position: centered above the selection, offset up
    let left = rect.left + rect.width / 2 - 14;
    let top = rect.top - 36;

    // Clamp to viewport
    left = Math.max(4, Math.min(left, window.innerWidth - 32));
    if (top < 4) {
      top = rect.bottom + 8;
    }

    this.iconEl.style.left = `${left}px`;
    this.iconEl.style.top = `${top}px`;
    this.iconEl.classList.add('visible');
  }

  hide(): void {
    this.iconEl.classList.remove('visible');
    this.clickCallback = null;
  }

  destroy(): void {
    this.host.remove();
  }
}
