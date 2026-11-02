import { homeArrange, homeArrangeText } from './homeArrangeRoles.ts';
import { bodyLineHeight, inset, size, space, textRoles } from './roles.ts';
import { minTouchTargetDp } from './tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  unshared,
  wrappedLineGaps,
  type NeighbourGaps,
} from './touchTarget.ts';

export type SegmentedControlSize =
  'default' | 'large' | 'inline' | 'editRow' | 'row';

const NONE = Number.POSITIVE_INFINITY;

// In a track, an option's edge sits inside the inset and border, a strip that
// is the option's alone.
const TRACK_EDGE = space.segmentInset + size.stroke;
const ROW_TRACK_EDGE = homeArrange.segmentInset + size.stroke;

export const INLINE_LINE_HEIGHT = textRoles.segment.size * bodyLineHeight;

export const OPTION_HEIGHTS: Readonly<Record<SegmentedControlSize, number>> = {
  default: textRoles.segment.size + inset.segmentOptionV * 2,
  large: size.segmentLargeOption,
  inline: INLINE_LINE_HEIGHT + inset.segmentOptionV * 2,
  editRow: size.segmentEditRowOption,
  row:
    homeArrangeText.segment.size * bodyLineHeight +
    homeArrange.segmentOptionV * 2,
};

// Options on a row between two others reach the target from the gaps alone.
export function wrappedRowGap(controlSize: SegmentedControlSize): number {
  return Math.max(
    space.segmentInset,
    minTouchTargetDp - OPTION_HEIGHTS[controlSize],
  );
}

export interface SegmentHitBoxInput {
  readonly controlSize: SegmentedControlSize;
  readonly compact: boolean;
  readonly outer: NeighbourGaps;
  /** Present once options may wrap: this option's row top and every row's. */
  readonly wrapped?:
    | {
        readonly lineTop: number | undefined;
        readonly lineTops: readonly number[];
      }
    | undefined;
}

function trackEdge({ controlSize, compact }: SegmentHitBoxInput): number {
  if (compact) return 0;
  return controlSize === 'row' ? ROW_TRACK_EDGE : TRACK_EDGE;
}

function verticalGaps(input: SegmentHitBoxInput): NeighbourGaps {
  const edge = unshared(trackEdge(input));
  const outer = {
    top: edge + (input.outer.top ?? NONE),
    bottom: edge + (input.outer.bottom ?? NONE),
  };
  if (input.wrapped === undefined) return outer;
  const rowGap = wrappedRowGap(input.controlSize);
  const { lineTop, lineTops } = input.wrapped;
  if (lineTop === undefined) {
    return {
      top: Math.min(rowGap, outer.top),
      bottom: Math.min(rowGap, outer.bottom),
    };
  }
  return wrappedLineGaps(lineTop, lineTops, outer, rowGap);
}

// Option widths are flex, so only the vertical axis is grown to 48dp; sideways
// every option takes the same half of the gap between options.
export function segmentHitBox(input: SegmentHitBoxInput) {
  const height = OPTION_HEIGHTS[input.controlSize];
  const vertical = hitExtension(height, height, verticalGaps(input));
  const side = space.segmentInset / 2;
  return hitBoxStyle({
    top: vertical.top,
    bottom: vertical.bottom,
    left: side,
    right: side,
  });
}
