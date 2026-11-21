import { inset, size, space, textRoles } from './roles.ts';
import {
  hitBoxStyle,
  hitExtension,
  unshared,
  type NeighbourGaps,
} from './touchTarget.ts';

// With an inert value badge between them, the keys are at least the badge's
// padding and border apart as well as two gaps; with a tappable one, only the
// gap separates key from badge.
const INERT_BADGE_GAP = 2 * (space.stepKeyGap + inset.badgeH + size.stroke);

// The inline key's width leaves out its glyph, so the box is a lower bound. An
// inert value lets the two keys meet at its midpoint.
const INLINE_KEY_WIDTH = inset.stepInlineKeyH * 2;
const INLINE_KEY_HEIGHT = textRoles.stepInline.size + inset.stepInlineKeyV * 2;
const INLINE_INNER_GAP = space.inlineKeyGap * 2 + size.stepValueMinWidth;
const INLINE_EDGE_H = inset.stepInlineH + size.stroke;
const INLINE_EDGE_V = inset.stepInlineV + size.stroke;

export const LARGE_KEY_HEIGHT = size.stepInlineLarge - size.stroke * 2;
const LARGE_EDGE_H = inset.stepInlineLargeH + size.stroke;

interface KeyGeometry {
  readonly width: number;
  readonly height: number;
  readonly inner: number;
  readonly gaps: NeighbourGaps;
}

function keyHitBoxes({ width, height, inner, gaps }: KeyGeometry) {
  const vertical = { top: gaps.top, bottom: gaps.bottom };
  return {
    decrement: hitBoxStyle(
      hitExtension(width, height, {
        ...vertical,
        left: gaps.left,
        right: inner,
      }),
    ),
    increment: hitBoxStyle(
      hitExtension(width, height, {
        ...vertical,
        left: inner,
        right: gaps.right,
      }),
    ),
  };
}

const plus = (edge: number, gap: number | undefined) =>
  unshared(edge) + (gap ?? Number.POSITIVE_INFINITY);

export function largeInlineKeyHitBoxes(
  gaps: NeighbourGaps,
  valueTappable: boolean,
) {
  return keyHitBoxes({
    width: size.stepInlineLargeKey,
    height: LARGE_KEY_HEIGHT,
    inner: valueTappable ? space.inlineKeyGap : INLINE_INNER_GAP,
    gaps: {
      top: plus(size.stroke, gaps.top),
      bottom: plus(size.stroke, gaps.bottom),
      left: plus(LARGE_EDGE_H, gaps.left),
      right: plus(LARGE_EDGE_H, gaps.right),
    },
  });
}

// Padding counts toward minWidth, so the box grows by what it reaches sideways.
export function inlineValueHitBox(gaps: NeighbourGaps, large: boolean) {
  const height = large ? LARGE_KEY_HEIGHT : INLINE_KEY_HEIGHT;
  const edgeV = large ? size.stroke : INLINE_EDGE_V;
  const reach = hitExtension(size.stepValueMinWidth, height, {
    top: plus(edgeV, gaps.top),
    bottom: plus(edgeV, gaps.bottom),
    left: space.inlineKeyGap,
    right: space.inlineKeyGap,
  });
  return {
    ...hitBoxStyle(reach),
    minWidth: size.stepValueMinWidth + reach.left + reach.right,
  };
}

export function stepKeyHitBoxes(
  gaps: NeighbourGaps,
  inline: boolean,
  valueTappable: boolean,
) {
  if (!inline) {
    return keyHitBoxes({
      width: size.stepKey,
      height: size.stepKey,
      inner: valueTappable ? space.stepKeyGap : INERT_BADGE_GAP,
      gaps,
    });
  }
  return keyHitBoxes({
    width: INLINE_KEY_WIDTH,
    height: INLINE_KEY_HEIGHT,
    inner: valueTappable ? space.inlineKeyGap : INLINE_INNER_GAP,
    gaps: {
      top: plus(INLINE_EDGE_V, gaps.top),
      bottom: plus(INLINE_EDGE_V, gaps.bottom),
      left: plus(INLINE_EDGE_H, gaps.left),
      right: plus(INLINE_EDGE_H, gaps.right),
    },
  });
}
