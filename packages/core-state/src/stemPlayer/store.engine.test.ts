import { createEngineUsers } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { createStemPlayerStore } from './store.ts';
import {
  BARS,
  fakeRuntime,
  record,
  SAVE_MS,
  SEEK_MS,
  stem,
} from './store.test-helper.ts';

const SET_ID = 7;

function setup() {
  const users = createEngineUsers();
  const fake = fakeRuntime(record([stem(1), stem(2)]));
  const store = createStemPlayerStore(
    () => fake.runtime,
    { mixSaveDelayMs: SAVE_MS, scrubSeekDelayMs: SEEK_MS },
    users,
  );
  return { ...fake, users, store };
}

describe('the output stream after a stem song', () => {
  it('is released on leaving when the metronome is stopped', async () => {
    const { store, commands } = setup();
    await store.getState().open(SET_ID, BARS);
    store.getState().close();
    expect(commands.stop).toHaveBeenCalledOnce();
  });

  it('stays open on leaving while the metronome plays', async () => {
    const { store, commands, users } = setup();
    await store.getState().open(SET_ID, BARS);
    users.claim('metronome');
    store.getState().close();
    expect(commands.stop).not.toHaveBeenCalled();
  });

  it('stays open while opening takes over the playing metronome', async () => {
    const { store, commands, users, sharedMetronome } = setup();
    users.claim('metronome');
    sharedMetronome.active.mockReturnValue(true);
    sharedMetronome.release.mockImplementation(() => {
      if (users.release('metronome')) commands.stop();
    });
    await store.getState().open(SET_ID, BARS);
    expect(commands.stop).not.toHaveBeenCalled();
  });

  it('is started again when a song opens after leaving', async () => {
    const { store, commands } = setup();
    await store.getState().open(SET_ID, BARS);
    store.getState().close();
    await store.getState().open(SET_ID, BARS);
    expect(commands.start).toHaveBeenCalledTimes(2);
    expect(store.getState().status).toBe('ready');
  });
});
