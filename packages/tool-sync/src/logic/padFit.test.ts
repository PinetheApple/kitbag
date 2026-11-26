import {
  metronome,
  space,
  stemPlayer,
  stemSections,
} from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { COMPACT_PAD_FLOOR, compactPadHeight } from './padFit.ts';

const NORMAL_SLOT = stemSections.padMinHeight + space.sectionGap;
const BPM_CARD = 101;
const SHORT_REGION = 286;
const TALL_REGION = 650;
const FONT_2_BPM_CARD = 194;
const FONT_2_REGION = 650;
const TINY_REGION = 140;

function bodyWindow(region: number, padHeight: number | null): number {
  return region - (padHeight ?? stemSections.padMinHeight) - space.sectionGap;
}

describe('compactPadHeight', () => {
  it('keeps the normal pad while the body window fits the BPM card', () => {
    expect(
      compactPadHeight({
        region: TALL_REGION,
        slot: NORMAL_SLOT,
        bpmCard: BPM_CARD,
      }),
    ).toBeNull();
  });

  it('keeps the normal pad at font 2.0 on a full-height screen', () => {
    expect(
      compactPadHeight({
        region: FONT_2_REGION,
        slot: NORMAL_SLOT,
        bpmCard: FONT_2_BPM_CARD,
      }),
    ).toBeNull();
  });

  it('compacts the pad when the body window cannot show the BPM card', () => {
    const height = compactPadHeight({
      region: SHORT_REGION,
      slot: NORMAL_SLOT,
      bpmCard: BPM_CARD,
    });
    expect(height).not.toBeNull();
    expect(height).toBeLessThan(stemSections.padMinHeight);
  });

  it('leaves the body window room for the whole BPM card at 360 x 480', () => {
    const height = compactPadHeight({
      region: SHORT_REGION,
      slot: NORMAL_SLOT,
      bpmCard: BPM_CARD,
    });
    expect(bodyWindow(SHORT_REGION, height)).toBeGreaterThanOrEqual(
      BPM_CARD + metronome.scrollFade,
    );
  });

  it('never shrinks the pad below the play button', () => {
    const height = compactPadHeight({
      region: TINY_REGION,
      slot: NORMAL_SLOT,
      bpmCard: BPM_CARD,
    });
    expect(height).toBe(COMPACT_PAD_FLOOR);
    expect(COMPACT_PAD_FLOOR).toBeGreaterThanOrEqual(stemPlayer.playButton);
  });

  it('waits for every measure before compacting', () => {
    expect(
      compactPadHeight({ region: SHORT_REGION, slot: 0, bpmCard: BPM_CARD }),
    ).toBeNull();
    expect(
      compactPadHeight({ region: SHORT_REGION, slot: NORMAL_SLOT, bpmCard: 0 }),
    ).toBeNull();
    expect(
      compactPadHeight({ region: 0, slot: NORMAL_SLOT, bpmCard: BPM_CARD }),
    ).toBeNull();
  });
});
