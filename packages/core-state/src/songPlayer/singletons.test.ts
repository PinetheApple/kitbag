import { expect, it } from 'vitest';

import { configureStemPlayer } from '../stemPlayer/runtime.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import {
  BARS as STEM_BARS,
  fakeRuntime,
  record,
  stem,
} from '../stemPlayer/store.test-helper.ts';
import { configureSongPlayer } from './runtime.ts';
import { songPlayerStore } from './store.ts';
import { BARS, fakeSongRuntime, SONG_ID } from './store.test-helper.ts';

const STEM_SET_ID = 7;

it('gives the app one mixer claim across its song and stem stores', async () => {
  configureStemPlayer(fakeRuntime(record([stem(1)])).runtime);
  configureSongPlayer(fakeSongRuntime().runtime);
  await stemPlayerStore.getState().open(STEM_SET_ID, STEM_BARS);
  await songPlayerStore.getState().open(SONG_ID, BARS).loaded;
  expect(stemPlayerStore.getState().setId).toBeNull();
  await stemPlayerStore.getState().open(STEM_SET_ID, STEM_BARS);
  expect(songPlayerStore.getState().songId).toBeNull();
  stemPlayerStore.getState().close();
});
