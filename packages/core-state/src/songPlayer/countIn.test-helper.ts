import { vi } from 'vitest';

import { COUNT_IN_DRAIN_MARGIN_SECONDS } from '../stemPlayer/countedStart.ts';
import { at } from '../stemPlayer/store.test-helper.ts';

import { openedSong, songRecord } from './store.test-helper.ts';

export const ONE_BAR = 1;
export const BAR_BEATS = 4;
export const BEAT = 0.5;
export const SEEK_IN_BAR_TWO = 2.2;

export const countEnd = (bars: number) =>
  at(COUNT_IN_DRAIN_MARGIN_SECONDS) + bars * BAR_BEATS * at(BEAT);

export type Song = Awaited<ReturnType<typeof openedSong>>;

export async function songWithCountIn(
  bars: number = ONE_BAR,
  { click = true, record = songRecord() } = {},
): Promise<Song> {
  const song = await openedSong(record);
  song.store.getState().setClickCountIn(bars);
  if (click) await song.store.getState().toggleClick();
  vi.clearAllMocks();
  return song;
}

export const counts = ({ commands }: Song) => commands.songCountIn.mock.calls;
