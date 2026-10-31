import type { Preferences } from '@kitbag/core-db';
import type { SavedArrangement } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

import {
  decodeArrangement,
  encodeArrangement,
  homeLayoutPreference,
} from './homeLayoutPreference.ts';

const LAYOUT: SavedArrangement = [
  { toolId: 'tuner', size: '2x1', hidden: false },
  { toolId: 'metronome', size: '1x1', hidden: true },
];

function memoryPreferences(): Preferences {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

describe('home layout on the database', () => {
  it('survives a reload', () => {
    const preferences = memoryPreferences();
    homeLayoutPreference(() => preferences).save(LAYOUT);
    expect(homeLayoutPreference(() => preferences).load()).toEqual(LAYOUT);
  });

  it('has no saved layout before the first arrange', () => {
    expect(
      homeLayoutPreference(() => memoryPreferences()).load(),
    ).toBeUndefined();
  });

  it('falls back to the default, without throwing, when the database will not open', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const persistence = homeLayoutPreference(() => {
      throw new Error('cannot open');
    });
    expect(persistence.load()).toBeUndefined();
    expect(() => {
      persistence.save(LAYOUT);
    }).not.toThrow();
    warn.mockRestore();
  });
});

describe('decodeArrangement', () => {
  it('round-trips what encodeArrangement wrote', () => {
    expect(decodeArrangement(encodeArrangement(LAYOUT))).toEqual(LAYOUT);
  });

  it('treats unreadable text as no saved layout', () => {
    expect(decodeArrangement('{not json')).toBeUndefined();
    expect(decodeArrangement('{"toolId":"tuner"}')).toBeUndefined();
  });

  it('drops entries that are not tiles', () => {
    const text = JSON.stringify([
      LAYOUT[0],
      { toolId: 7, size: '1x1', hidden: false },
      { toolId: 'stems', size: '1x1' },
      null,
    ]);
    expect(decodeArrangement(text)).toEqual([LAYOUT[0]]);
  });
});
