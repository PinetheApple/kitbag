import {
  customSoundId,
  KB_CUSTOM_SOUND_SLOTS,
  KB_SOUND_NAMES,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  customSoundViews,
  rolesUsing,
  SOUND_OPTIONS,
  SOUND_ROLE,
  soundChipLabel,
  soundLabel,
  soundsWith,
} from './soundChoice.ts';

const RIMSHOT = {
  slot: 0,
  uuid: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
  name: 'Rimshot',
  fileName: 'a.wav',
};
const HAT = { ...RIMSHOT, slot: 1, name: 'Hat', fileName: 'b.wav' };
const RIM_ID = customSoundId(RIMSHOT.slot);
const HAT_ID = customSoundId(HAT.slot);

describe('sound picker names come from the engine table', () => {
  it('lists one option per engine sound id, in id order', () => {
    expect(SOUND_OPTIONS).toHaveLength(KB_SOUND_NAMES.length);
    expect(SOUND_OPTIONS.map((o) => o.value)).toEqual(
      KB_SOUND_NAMES.map((_, id) => String(id)),
    );
    expect(SOUND_OPTIONS.map((o) => o.label)).toEqual([
      'Beep',
      'Woodblock',
      'Click',
      'Tom',
      'Tick',
      'Cowbell',
    ]);
  });

  it('labels an unknown id generically rather than inventing a name', () => {
    expect(soundLabel(customSoundId(KB_CUSTOM_SOUND_SLOTS))).toBe('Sound');
  });
});

describe('custom sound names come from the stored sounds', () => {
  const custom = customSoundViews([RIMSHOT, HAT], [HAT.slot]);

  it('names a custom id by its stored sound', () => {
    expect(soundLabel(RIM_ID, custom)).toBe('Rimshot');
  });

  it('names an unavailable custom sound by what plays, Tick', () => {
    expect(custom.map((view) => view.available)).toEqual([true, false]);
    expect(soundLabel(HAT_ID, custom)).toBe('Tick');
  });

  it('names an empty custom slot Tick, as the engine plays it', () => {
    expect(soundLabel(RIM_ID)).toBe('Tick');
  });

  it('shows custom names on the chip', () => {
    expect(soundChipLabel({ normal: 1, accent: RIM_ID }, custom)).toBe(
      'Woodblock · Rimshot',
    );
  });

  it('lists the roles a sound is on', () => {
    expect(rolesUsing({ normal: RIM_ID, accent: RIM_ID }, RIM_ID)).toEqual([
      'normal',
      'accent',
    ]);
    expect(rolesUsing({ normal: 1, accent: RIM_ID }, RIM_ID)).toEqual([
      'accent',
    ]);
    expect(rolesUsing({ normal: 1, accent: 1 }, RIM_ID)).toEqual([]);
  });
});

describe('per-role selection', () => {
  it('changes only the selected role', () => {
    const sounds = { normal: 1, accent: 3 };
    expect(soundsWith(sounds, SOUND_ROLE.accent, 5)).toEqual({
      normal: 1,
      accent: 5,
    });
    expect(soundsWith(sounds, SOUND_ROLE.normal, 0)).toEqual({
      normal: 0,
      accent: 3,
    });
  });

  it('shows both sounds on the chip only when they differ', () => {
    expect(soundChipLabel({ normal: 1, accent: 1 })).toBe('Woodblock');
    expect(soundChipLabel({ normal: 1, accent: 3 })).toBe('Woodblock · Tom');
  });
});
