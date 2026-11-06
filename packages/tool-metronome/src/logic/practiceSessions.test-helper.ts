import {
  createLibraryStore,
  createMetronomeStore,
  createPracticeSessionStore,
  practiceElapsedMs,
  type MetronomeCommands,
  type PracticePersistence,
} from '@kitbag/core-state';
import { vi } from 'vitest';

import { endPractice } from './practiceSummary.ts';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

const noCommands = new Proxy(
  {},
  { get: () => () => Promise.resolve(0) },
) as MetronomeCommands;

export function practiceHarness() {
  let clock = 0;
  let uuids = 0;
  const now = () => clock;
  const metronome = createMetronomeStore(
    noCommands,
    () => 0,
    () => 100,
    now,
  );
  const library = createLibraryStore({
    repos: () => {
      throw new Error('no repositories in this test');
    },
    metronome: () => metronome.getState(),
    now,
  });
  const insert = vi.fn<PracticePersistence['insert']>(() => Promise.resolve());
  const sessions = createPracticeSessionStore({
    metronome,
    library,
    persistence: { insert },
    now,
    newUuid: () => `session-${String(++uuids)}`,
    every: () => () => undefined,
  });
  const advance = (ms: number) => {
    clock += ms;
  };
  const pill = () => practiceElapsedMs(metronome.getState().practice, clock);
  const end = () => {
    endPractice(sessions, metronome.getState().resetPractice);
  };
  return { metronome, sessions, insert, advance, pill, end };
}
