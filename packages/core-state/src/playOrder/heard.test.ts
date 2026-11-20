import { describe, expect, it } from 'vitest';

import {
  droppedTrailing,
  forgetSong,
  heardAfter,
  heardStore,
  withoutSong,
} from './heard.ts';
import { HUM, NIGHT_BUS, plain } from './heard.test-helper.ts';

describe('the songs heard this listening session', () => {
  it('adds a song once however often it shows again in a row', () => {
    const heard = heardAfter(heardAfter([], plain(HUM)), plain(HUM));
    expect(heard).toEqual([plain(HUM)]);
    expect(heardAfter(heard, plain(NIGHT_BUS))).toEqual([
      plain(HUM),
      plain(NIGHT_BUS),
    ]);
  });

  it('forgets only the song left at the end', () => {
    const heard = [plain(HUM), plain(NIGHT_BUS), plain(HUM)];
    expect(droppedTrailing(heard, HUM)).toEqual([plain(HUM), plain(NIGHT_BUS)]);
    expect(droppedTrailing(heard, NIGHT_BUS)).toEqual(heard);
  });

  it('forgets every hearing of a song that can no longer play', () => {
    const heard = [plain(HUM), plain(NIGHT_BUS), plain(HUM)];
    expect(withoutSong(heard, HUM)).toEqual([plain(NIGHT_BUS)]);
    heardStore.setState({ heard });
    forgetSong(NIGHT_BUS);
    expect(heardStore.getState().heard).toEqual([plain(HUM), plain(HUM)]);
  });
});
