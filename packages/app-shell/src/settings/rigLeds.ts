import { rig, size, space, type LedSize } from '@kitbag/core-design';

const ledsWidth = (count: number, led: number, gap: number) =>
  count * led + (count - 1) * gap;

export function previewLedSize(count: number): LedSize {
  return ledsWidth(count, size.ledSmall, space.ledGap) <= rig.accentPreviewWidth
    ? 'small'
    : 'tiny';
}
