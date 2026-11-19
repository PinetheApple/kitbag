import { KB_ACCENT, KB_SOUND_NAMES, customSoundId } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  accentedBeats,
  clickChips,
  clickSoundName,
  CLICK_GROUP,
  COUNT_IN_OPTIONS,
  SOUND_OPTIONS,
} from './clickChipText.ts';

const {
  KB_ACCENT_ACCENTED: ACC,
  KB_ACCENT_NORMAL: NOR,
  KB_ACCENT_MUTED: MUT,
} = KB_ACCENT;
const WOODBLOCK = KB_SOUND_NAMES.indexOf('woodblock');
const COWBELL = KB_SOUND_NAMES.indexOf('cowbell');
const CUSTOM_SLOT = 0;
const CUSTOM = [{ slot: CUSTOM_SLOT, name: 'Rimshot' }] as never;

function chipFor(
  group: string,
  accents: readonly KB_ACCENT[] = [ACC, NOR, NOR, NOR],
) {
  const chips = clickChips(
    { sounds: { normal: WOODBLOCK, accent: COWBELL }, accents },
    [],
  );
  return chips.find((chip) => chip.group === group);
}

describe('clickChips', () => {
  it('draws Count-in, Click and Accent in that order', () => {
    expect(
      clickChips(
        { sounds: { normal: WOODBLOCK, accent: COWBELL }, accents: [] },
        [],
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

describe('clickSoundName', () => {
  it('names a custom sound by its own name', () => {
    expect(clickSoundName(customSoundId(CUSTOM_SLOT), CUSTOM)).toBe('Rimshot');
  });

  it('falls back to the default sound for a custom sound that is gone', () => {
    expect(clickSoundName(customSoundId(CUSTOM_SLOT), [])).toBe('Tick');
  });
});

describe('the sheet options', () => {
  it('offers one tile per engine sound', () => {
    expect(SOUND_OPTIONS.map((o) => o.value)).toEqual(
      KB_SOUND_NAMES.map((_, id) => String(id)),
    );
  });

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
