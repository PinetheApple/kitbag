import { KB_ACCENT, KB_SOUND_NAMES, customSoundId } from '@kitbag/core-native';
import { customSoundViews } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  accentedBeats,
  clickChips,
  CLICK_GROUP,
  COUNT_IN_OPTIONS,
} from './clickChipText.ts';

const {
  KB_ACCENT_ACCENTED: ACC,
  KB_ACCENT_NORMAL: NOR,
  KB_ACCENT_MUTED: MUT,
} = KB_ACCENT;
const WOODBLOCK = KB_SOUND_NAMES.indexOf('woodblock');
const COWBELL = KB_SOUND_NAMES.indexOf('cowbell');
const RIMSHOT = {
  slot: 0,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
  fileName: 'a.wav',
};
const RIM_ID = customSoundId(RIMSHOT.slot);

function chipFor(
  group: string,
  accents: readonly KB_ACCENT[] = [ACC, NOR, NOR, NOR],
  hasGrid = true,
) {
  const chips = clickChips(
    { sounds: { normal: WOODBLOCK, accent: COWBELL }, accents },
    [],
    hasGrid,
  );
  return chips.find((chip) => chip.group === group);
}

describe('clickChips', () => {
  it('draws Count-in, Click and Accent in that order', () => {
    expect(
      clickChips(
        { sounds: { normal: WOODBLOCK, accent: COWBELL }, accents: [] },
        [],
        true,
      ).map((chip) => chip.group),
    ).toEqual([CLICK_GROUP.countIn, CLICK_GROUP.sound, CLICK_GROUP.accents]);
  });

  it('names the normal sound from the engine list', () => {
    expect(chipFor(CLICK_GROUP.sound)?.label).toBe('Click: Woodblock');
  });

  it('lists the accented beats', () => {
    expect(chipFor(CLICK_GROUP.accents)?.label).toBe('Accent 1');
    expect(chipFor(CLICK_GROUP.accents, [ACC, MUT, ACC])?.label).toBe(
      'Accent 1 · 3',
    );
  });

  it('says when no beat is accented, and is not lit then', () => {
    const chip = chipFor(CLICK_GROUP.accents, [NOR, NOR, MUT]);
    expect(chip?.label).toBe('No accent');
    expect(chip?.active).toBe(false);
  });

  it('mutes the Count-in chip and says why aloud', () => {
    const chip = chipFor(CLICK_GROUP.countIn);
    expect(chip?.muted).toBe(true);
    expect(chip?.spoken).toContain('Arrives with count-in for songs.');
  });
});

describe('the Click chip with a custom sound', () => {
  const soundChip = (unavailable: readonly number[]) =>
    clickChips(
      { sounds: { normal: RIM_ID, accent: COWBELL }, accents: [] },
      customSoundViews([RIMSHOT], unavailable),
      true,
    ).find((chip) => chip.group === CLICK_GROUP.sound)?.label;

  it('names it by its own name', () => {
    expect(soundChip([])).toBe('Click: Rimshot');
  });

  it('names an unavailable one by what plays instead', () => {
    expect(soundChip([RIMSHOT.slot])).toBe('Click: Tick');
  });
});

describe('the chips with no grid', () => {
  it('mutes every chip and lights none', () => {
    for (const group of Object.values(CLICK_GROUP)) {
      const chip = chipFor(group, [ACC, NOR, NOR, NOR], false);
      expect(chip?.muted).toBe(true);
      expect(chip?.active).toBe(false);
    }
  });

  it('lights the accent chip again once the grid is there', () => {
    expect(chipFor(CLICK_GROUP.accents)?.active).toBe(true);
  });
});

describe('the sheet options', () => {
  it('offers the engine count-in lengths, all muted', () => {
    expect(COUNT_IN_OPTIONS.map((o) => o.label)).toEqual([
      'Off',
      '1 bar',
      '2 bars',
      '4 bars',
    ]);
    expect(COUNT_IN_OPTIONS.every((o) => o.disabled)).toBe(true);
  });
});

describe('accentedBeats', () => {
  it('numbers beats from one', () => {
    expect(accentedBeats([NOR, ACC, MUT, ACC])).toEqual([2, 4]);
  });
});
