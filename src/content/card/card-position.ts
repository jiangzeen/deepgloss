export interface CardPositionResult {
  left: number;
  top: number;
  maxHeight: number;
}

const CARD_MARGIN = 8;

/**
 * Calculate card position, clamped to viewport.
 */
export function calculateCardPosition(
  selectionRect: DOMRect,
  cardWidth: number,
  position: 'below' | 'sidebar',
): CardPositionResult {
  if (position === 'sidebar') {
    return {
      left: window.innerWidth - cardWidth - 16,
      top: 16,
      maxHeight: window.innerHeight - 32,
    };
  }

  // Below selection
  let left = selectionRect.left;
  let top = selectionRect.bottom + CARD_MARGIN;

  // Clamp horizontal
  if (left + cardWidth > window.innerWidth - CARD_MARGIN) {
    left = window.innerWidth - cardWidth - CARD_MARGIN;
  }
  left = Math.max(CARD_MARGIN, left);

  // Available space below
  const spaceBelow = window.innerHeight - selectionRect.bottom - CARD_MARGIN;
  const spaceAbove = selectionRect.top - CARD_MARGIN;

  // If not enough space below, try above
  let maxHeight = spaceBelow - CARD_MARGIN;
  if (spaceBelow < 150 && spaceAbove > spaceBelow) {
    maxHeight = spaceAbove - CARD_MARGIN;
    // Position above: we don't know card height yet, so set a max
    // and let CSS handle it with max-height + bottom alignment
    top = Math.max(CARD_MARGIN, selectionRect.top - Math.min(400, spaceAbove));
  }

  maxHeight = Math.max(100, maxHeight);

  return { left, top, maxHeight };
}
