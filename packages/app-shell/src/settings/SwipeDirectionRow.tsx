import {
  EditRow,
  SegmentedControl,
  type SegmentOption,
} from '@kitbag/core-design';
import {
  SWIPE_DIRECTION,
  useHistoryPrefs,
  type SwipeDirection,
} from '@kitbag/core-state';

export const SWIPE_DIRECTION_LABEL = 'Swipe to delete';

const SWIPE_OPTIONS: readonly SegmentOption<SwipeDirection>[] = [
  { value: SWIPE_DIRECTION.left, label: 'Left' },
  { value: SWIPE_DIRECTION.right, label: 'Right' },
];

export function SwipeDirectionRow({
  gaps,
}: {
  readonly gaps: { readonly bottom: number };
}) {
  const direction = useHistoryPrefs((s) => s.swipeDirection);
  const setDirection = useHistoryPrefs((s) => s.setSwipeDirection);
  return (
    <EditRow label={SWIPE_DIRECTION_LABEL}>
      <SegmentedControl
        compact
        size="inline"
        accessibilityLabel={SWIPE_DIRECTION_LABEL}
        options={SWIPE_OPTIONS}
        selected={direction}
        onSelect={setDirection}
        neighbourGapDp={gaps}
      />
    </EditRow>
  );
}
