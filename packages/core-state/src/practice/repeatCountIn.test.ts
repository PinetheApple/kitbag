import { presetFieldsOfLogged } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyPreset } from '../library/presetMapping.ts';
import { SONG_STEP } from '../library/setlistPosition.ts';
import { createLibraryStore } from '../library/store.ts';
import {
  configureCountInPersistence,
  reloadCountInPersistence,
  type CountInSettings,
} from '../metronome/countInPersistence.ts';
import { COUNT_IN_SCOPE } from '../metronome/countInScope.ts';
import { stubMetronomeRuntime } from '../metronome/runtime.test-helper.ts';
import { metronomeStore } from '../metronome/store.ts';
import { repeatPlanOf } from './repeat.ts';
import { COUNT_IN, gig } from './repeat.test-helper.ts';
import { createRepeatOverlay } from './repeatOverlay.ts';

const ENGINE_BPM = 120;
const BPMS = [70, 80, 90] as const;
const USER: Partial<CountInSettings> = {
  scope: COUNT_IN_SCOPE.perSong,
  bars: 1,
  distinct: false,
  sound: 0,
};

stubMetronomeRuntime(ENGINE_BPM);

let stored: Partial<CountInSettings> = USER;
const save = vi.fn((changed: Partial<CountInSettings>) => {
  stored = { ...stored, ...changed };
});
configureCountInPersistence({ load: () => stored, save });

beforeEach(() => {
  stored = USER;
  reloadCountInPersistence();
  save.mockClear();
});

async function perSongGig() {
  const g = await gig();
  const library = createLibraryStore({
    repos: () => g.repos,
    metronome: () => metronomeStore.getState(),
    now: Date.now,
  });
  await library.getState().refresh();
  const overlay = createRepeatOverlay({
    library,
    metronome: metronomeStore,
    applySettings: (settings) => {
      applyPreset(presetFieldsOfLogged(settings), () =>
        metronomeStore.getState(),
      );
    },
  });
  const plan = repeatPlanOf(g.log(BPMS), library.getState());
  if (plan === null) throw new Error('no plan');
  return { ...g, library, overlay, plan };
}

describe('per-song count-in during a Repeat', () => {
  it('never saves the logged bars on start or on stepSong', async () => {
    const r = await perSongGig();
    expect(r.first.countInBars).not.toBe(COUNT_IN.bars);
    await r.overlay.start(r.plan);
    expect(metronomeStore.getState().countIn.bars).toBe(COUNT_IN.bars);
    await r.library.getState().stepSong(SONG_STEP.next);
    expect(save).not.toHaveBeenCalled();
    reloadCountInPersistence();
    expect(stored.bars).toBe(USER.bars);
  });

  it('never saves the logged bars when stepping on from a reverted song', async () => {
    const r = await perSongGig();
    await r.overlay.start(r.plan);
    r.library.getState().revertLoadedSong();
    save.mockClear();
    await r.library.getState().stepSong(SONG_STEP.next);
    expect(metronomeStore.getState().countIn.bars).toBe(COUNT_IN.bars);
    expect(save).not.toHaveBeenCalledWith(
      expect.objectContaining({ bars: COUNT_IN.bars }),
    );
  });

  it('still saves the bars of a song loaded outside a Repeat', async () => {
    const r = await perSongGig();
    await r.library
      .getState()
      .loadSong(r.second.id, r.entries[1]?.item.id, r.setlistId);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ bars: r.second.countInBars }),
    );
  });
});
