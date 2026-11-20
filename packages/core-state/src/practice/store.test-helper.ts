import { expect, vi } from 'vitest';

import { isPresetEntry } from '../library/snapshot.ts';
import { setup } from '../library/store.test-helper.ts';
import { PRACTICE_TEMPO_SAMPLE_MS } from './session.ts';
import {
  createPracticeSessionStore,
  type PracticePersistence,
} from './store.ts';

export function harness(engineBpm = () => 100) {
  const { library, metronome } = setup(engineBpm);
  let clock = 0;
  let uuids = 0;
  const ticks: (() => void)[] = [];
  const insert = vi.fn<PracticePersistence['insert']>(() => Promise.resolve());
  const practice = createPracticeSessionStore({
    metronome,
    library,
    persistence: { insert },
    now: () => clock,
    newUuid: () => `session-${String(++uuids)}`,
    every: (ms, tick) => {
      expect(ms).toBe(PRACTICE_TEMPO_SAMPLE_MS);
      ticks.push(tick);
      return () => {
        ticks.splice(ticks.indexOf(tick), 1);
      };
    },
  });
  const advance = (ms: number) => {
    const end = clock + ms;
    while (clock + PRACTICE_TEMPO_SAMPLE_MS <= end) {
      clock += PRACTICE_TEMPO_SAMPLE_MS;
      for (const tick of [...ticks]) tick();
    }
    clock = end;
  };
  return { library, metronome, practice, insert, advance, ticks };
}

export async function onStage(h: ReturnType<typeof harness>) {
  const s = h.library.getState();
  const gig = await s.createSetlist('Gig');
  const first = await s.newSongFromCurrent('First', gig);
  const second = await s.newSongFromCurrent('Second', gig);
  const entries = (h.library.getState().entries[gig] ?? []).filter(
    isPresetEntry,
  );
  const load = (index: number) => {
    const entry = entries[index];
    if (entry === undefined) throw new Error('missing entry');
    return h.library.getState().loadSong(entry.preset.id, entry.item.id, gig);
  };
  const uuidOf = (id: number) =>
    h.library.getState().presets.find((preset) => preset.id === id)?.uuid;
  return { gig, load, uuids: [uuidOf(first), uuidOf(second)] };
}
