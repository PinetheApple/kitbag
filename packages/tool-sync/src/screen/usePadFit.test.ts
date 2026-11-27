// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { space, tapPad } from '@kitbag/core-design';
import { act, createElement } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({}));

const { usePadFit } = await import('./usePadFit.ts');
const { COMPACT_PAD_FLOOR } = await import('../logic/padFit.ts');

type PadFit = ReturnType<typeof usePadFit>;

const NORMAL_SLOT = tapPad.minHeight + space.sectionGap;
const BPM_CARD = 101.5;
const BPM_CARD_TOP = 84.6;
const SHORT_REGION = 287.5;
const TALL_REGION = 650;

function layout(height: number, y = 0): LayoutChangeEvent {
  return {
    nativeEvent: { layout: { x: 0, y, width: 0, height } },
  } as LayoutChangeEvent;
}

function mounted() {
  let fit: PadFit | undefined;
  function Probe() {
    fit = usePadFit();
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  const current = () => {
    if (fit === undefined) throw new Error('not mounted');
    return fit;
  };
  const measure = (
    region: number,
    slot: number,
    bpmCard: number,
    bpmCardTop = 0,
  ) => {
    act(() => {
      current().onRegion(layout(region));
      current().onSlot(layout(slot));
      current().onBpmCard(layout(bpmCard, bpmCardTop));
    });
    return current().padHeight;
  };
  return { current, measure };
}

describe('usePadFit', () => {
  it('keeps the normal pad on a tall window', () => {
    expect(mounted().measure(TALL_REGION, NORMAL_SLOT, BPM_CARD)).toBeNull();
  });

  it('compacts the pad on a short window', () => {
    const height = mounted().measure(SHORT_REGION, NORMAL_SLOT, BPM_CARD);
    expect(height).not.toBeNull();
    expect(height).toBeLessThan(tapPad.minHeight);
  });

  it('fits the BPM card by its bottom edge, under the song card above it', () => {
    expect(
      mounted().measure(SHORT_REGION, NORMAL_SLOT, BPM_CARD, BPM_CARD_TOP),
    ).toBe(COMPACT_PAD_FLOOR);
  });

  it('judges the fit on the normal pad, not on the compact one it drew', () => {
    const { current, measure } = mounted();
    const compact = measure(SHORT_REGION, NORMAL_SLOT, BPM_CARD);
    act(() => {
      current().onSlot(layout((compact ?? 0) + space.sectionGap));
    });
    expect(current().padHeight).toBe(compact);
  });
});
