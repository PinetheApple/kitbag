import { metronome, space, stemPlayer, tapPad } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { COMPACT_PAD_FLOOR, compactPadHeight } from './padFit.ts';

const NORMAL_SLOT = tapPad.minHeight + space.sectionGap;
const BPM_CARD_BOTTOM = 186;
const TALL_REGION = 650;
const FONT_2_BPM_CARD_BOTTOM = 300;
const SHORT_REGION = 287.5;
const ROOMY_SHORT_REGION = 320;
const TINY_REGION = 140;

function bodyWindow(region: number, padHeight: number | null): number {
  return region - (padHeight ?? tapPad.minHeight) - space.sectionGap;
}

describe('compactPadHeight', () => {
  it('keeps the normal pad while the body window fits the BPM card', () => {
    expect(
      compactPadHeight({
        region: TALL_REGION,
        slot: NORMAL_SLOT,
        bpmCardBottom: BPM_CARD_BOTTOM,
      }),
    ).toBeNull();
  });

  it('keeps the normal pad at font 2.0 on a full-height screen', () => {
    expect(
      compactPadHeight({
        region: TALL_REGION,
        slot: NORMAL_SLOT,
        bpmCardBottom: FONT_2_BPM_CARD_BOTTOM,
      }),
    ).toBeNull();
  });

  it('keeps the whole BPM card above the pad at 360 x 480, below the song card', () => {
    const height = compactPadHeight({
      region: SHORT_REGION,
      slot: NORMAL_SLOT,
      bpmCardBottom: BPM_CARD_BOTTOM,
    });
    expect(height).toBe(COMPACT_PAD_FLOOR);
    expect(bodyWindow(SHORT_REGION, height)).toBeGreaterThanOrEqual(
      BPM_CARD_BOTTOM,
    );
  });

  it('clears the BPM card of the scroll fade when the window has room', () => {
    const height = compactPadHeight({
      region: ROOMY_SHORT_REGION,
      slot: NORMAL_SLOT,
      bpmCardBottom: BPM_CARD_BOTTOM,
    });
    expect(height).toBeGreaterThan(COMPACT_PAD_FLOOR);
    expect(bodyWindow(ROOMY_SHORT_REGION, height)).toBe(
      BPM_CARD_BOTTOM + metronome.scrollFade,
    );
  });

  it('never shrinks the pad below the play button', () => {
    const height = compactPadHeight({
      region: TINY_REGION,
      slot: NORMAL_SLOT,
      bpmCardBottom: BPM_CARD_BOTTOM,
    });
    expect(height).toBe(COMPACT_PAD_FLOOR);
    expect(COMPACT_PAD_FLOOR).toBeGreaterThanOrEqual(stemPlayer.playButton);
  });

  it('waits for every measure before compacting', () => {
    expect(
      compactPadHeight({
        region: SHORT_REGION,
        slot: 0,
        bpmCardBottom: BPM_CARD_BOTTOM,
      }),
    ).toBeNull();
    expect(
      compactPadHeight({
        region: SHORT_REGION,
        slot: NORMAL_SLOT,
        bpmCardBottom: 0,
      }),
    ).toBeNull();
    expect(
      compactPadHeight({
        region: 0,
        slot: NORMAL_SLOT,
        bpmCardBottom: BPM_CARD_BOTTOM,
      }),
    ).toBeNull();
  });
});
