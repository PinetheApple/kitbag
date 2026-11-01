import { COUNT_IN_PREFERENCE_KEYS, type Preferences } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { countInPreference } from './countInPreference.ts';

const STORED_SOUND = 4;

function memoryPreferences(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const preferences: Preferences = {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
  return { preferences, data };
}

describe('count-in settings on the database', () => {
  it('survive a reload, each under its own key', () => {
    const { preferences, data } = memoryPreferences();
    countInPreference(() => preferences).save({ scope: 'always', bars: 2 });
    countInPreference(() => preferences).save({
      distinct: false,
      sound: STORED_SOUND,
    });

    expect(countInPreference(() => preferences).load()).toEqual({
      scope: 'always',
      bars: 2,
      distinct: false,
      sound: STORED_SOUND,
    });
    expect(Object.fromEntries(data)).toEqual({
      [COUNT_IN_PREFERENCE_KEYS.scope]: 'always',
      [COUNT_IN_PREFERENCE_KEYS.bars]: '2',
      [COUNT_IN_PREFERENCE_KEYS.distinct]: '0',
      [COUNT_IN_PREFERENCE_KEYS.sound]: String(STORED_SOUND),
    });
  });

  it('leave out a value they do not recognise, so the default applies', () => {
    const { preferences } = memoryPreferences({
      [COUNT_IN_PREFERENCE_KEYS.scope]: 'sometimes',
      [COUNT_IN_PREFERENCE_KEYS.bars]: '3',
      [COUNT_IN_PREFERENCE_KEYS.distinct]: 'yes',
      [COUNT_IN_PREFERENCE_KEYS.sound]: '99',
    });
    expect(countInPreference(() => preferences).load()).toEqual({});
  });

  it('read a restored value that is not a whole number as missing', () => {
    const { preferences } = memoryPreferences({
      [COUNT_IN_PREFERENCE_KEYS.bars]: '2.0x',
      [COUNT_IN_PREFERENCE_KEYS.sound]: '',
    });
    expect(countInPreference(() => preferences).load()).toEqual({});
  });
});
