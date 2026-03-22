import { SELECTION_DEBOUNCE_MS, MIN_SELECTION_LENGTH, MAX_CONTEXT_LENGTH } from '@/shared/constants';

export interface SelectionInfo {
  text: string;
  rect: DOMRect;
  context: string;
}

type SelectionCallback = (info: SelectionInfo) => void;
type ClearCallback = () => void;

/**
 * Detects text selection with performance optimizations:
 * - Debounced mouseup handler
 * - Pre-warmed rect via selectionchange
 * - Minimum text length filter
 */
export class SelectionDetector {
  private onSelectionCb: SelectionCallback | null = null;
  private onClearCb: ClearCallback | null = null;
  private lastRect: DOMRect | null = null;
  private debounceTimer = 0;

  constructor() {
    document.addEventListener('selectionchange', this.handleSelectionChange);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('touchend', this.handleMouseUp);
  }

  onSelection(cb: SelectionCallback): void {
    this.onSelectionCb = cb;
  }

  onSelectionClear(cb: ClearCallback): void {
    this.onClearCb = cb;
  }

  private handleSelectionChange = (): void => {
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      this.lastRect = range.getBoundingClientRect();
    }
  };

  private handleMouseUp = (): void => {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        this.onClearCb?.();
        return;
      }

      const text = sel.toString().trim();
      if (text.length < MIN_SELECTION_LENGTH) {
        this.onClearCb?.();
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = this.lastRect || range.getBoundingClientRect();

      // Extract context from parent element
      const container = range.commonAncestorContainer;
      const parentEl = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as HTMLElement;
      const context = (parentEl?.textContent || '').slice(0, MAX_CONTEXT_LENGTH);

      this.onSelectionCb?.({ text, rect, context });
    }, SELECTION_DEBOUNCE_MS);
  };

  destroy(): void {
    clearTimeout(this.debounceTimer);
    document.removeEventListener('selectionchange', this.handleSelectionChange);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchend', this.handleMouseUp);
  }
}
