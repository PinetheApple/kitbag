import { describe, expect, it } from 'vitest';

import type { StoredPreference } from '../runtime/storedPreference.ts';

import { toolEnabledKey, toolsPersistence } from './toolsPreference.ts';

const ROSTER = ['metronome', 'tuner', 'stems'];

function memory() {
  const data = new Map<string, string>();
  const stored = (key: string): StoredPreference => ({
    read: () => data.get(key),
    write: (value) => {
      data.set(key, value);
    },
  });
  return { data, stored };
}

describe('tool switches in preferences', () => {
  it('has every tool on when nothing is stored', () => {
    expect(toolsPersistence(memory().stored, ROSTER).load()).toEqual([]);
  });

  it('survives a reload', () => {
    const { stored } = memory();
    toolsPersistence(stored, ROSTER).save(['tuner']);
    expect(toolsPersistence(stored, ROSTER).load()).toEqual(['tuner']);
  });

  it('stores one switch per tool under its own key', () => {
    const { data, stored } = memory();
    toolsPersistence(stored, ROSTER).save(['stems']);
    expect(data.get(toolEnabledKey('stems'))).toBe('false');
    expect(data.get(toolEnabledKey('metronome'))).toBe('true');
  });

  it('turns a tool back on', () => {
    const { stored } = memory();
    const persistence = toolsPersistence(stored, ROSTER);
    persistence.save(['stems']);
    persistence.save([]);
    expect(persistence.load()).toEqual([]);
  });
});
