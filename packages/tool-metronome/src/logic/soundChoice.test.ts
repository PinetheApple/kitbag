import { KB_SOUND_NAMES } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  SOUND_OPTIONS,
  SOUND_ROLE,
  soundChipLabel,
  soundLabel,
  soundsWith,
} from './soundChoice.ts';

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
      'Hi-hat',
      'Cowbell',
    ]);
  });

  it('labels an unknown id generically rather than inventing a name', () => {
    expect(soundLabel(KB_SOUND_NAMES.length)).toBe('Sound');
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
