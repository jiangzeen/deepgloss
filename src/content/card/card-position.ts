export type CardPlacement = 'below' | 'above' | 'sidebar';

export interface CardPositionResult {
  left: number;
  top: number;
  maxHeight: number;
  placement: CardPlacement;
}

const CARD_MARGIN = 8;
/** Below this, a card is too cramped to be useful — prefer flipping. */
const MIN_USABLE_HEIGHT = 180;

/**
 * Calculate card position, clamped to the viewport.
 *
 * For `above` placement the returned `top` is the **bottom** edge of the card:
 * the host applies `transform: translateY(-100%)`, so the card grows upward and
 * always stays anchored to the selection regardless of its actual height.
 */
export function calculateCardPosition(
  selectionRect: DOMRect,
  cardWidth: number,
  position: 'below' | 'sidebar',
): CardPositionResult {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (position === 'sidebar') {
    return {
      left: Math.max(CARD_MARGIN, vw - cardWidth - 16),
      top: 16,
      maxHeight: vh - 32,
      placement: 'sidebar',
    };
  }

  // Horizontal: center on selection, then clamp inside the viewport.
  let left = selectionRect.left + selectionRect.width / 2 - cardWidth / 2;
  left = Math.min(left, vw - cardWidth - CARD_MARGIN);
  left = Math.max(CARD_MARGIN, left);

  // Available space on each side (already margin-safe).
  const spaceBelow = vh - selectionRect.bottom - CARD_MARGIN * 2;
  const spaceAbove = selectionRect.top - CARD_MARGIN * 2;

  const placeAbove = spaceBelow < MIN_USABLE_HEIGHT && spaceAbove > spaceBelow;

  if (placeAbove) {
    return {
      left,
      top: Math.max(CARD_MARGIN, selectionRect.top - CARD_MARGIN),
      maxHeight: Math.max(MIN_USABLE_HEIGHT, spaceAbove),
      placement: 'above',
    };
  }

  return {
    left,
    top: selectionRect.bottom + CARD_MARGIN,
    maxHeight: Math.max(MIN_USABLE_HEIGHT, spaceBelow),
    placement: 'below',
  };
}
