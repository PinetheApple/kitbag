import type { QueuedSong, SetlistItem, SongPreset } from '@kitbag/core-db';
import { vi } from 'vitest';

import type { ViewLibrary } from './viewedPlay.ts';

export const SETLIST_ID = 1;

function item(id: number): SetlistItem {
  return { id } as SetlistItem;
}

function entryOf(song: QueuedSong, id: number) {
  if (song.kind === 'stems')
    return { kind: 'stem' as const, item: item(id), stemSetId: song.id };
  const preset = { id, librarySongId: song.id } as SongPreset;
  return { kind: 'preset' as const, item: item(id), preset };
}

export function startedSetlist(...songs: QueuedSong[]): ViewLibrary {
  return {
    session: { setlistId: SETLIST_ID, skipped: [] },
    entries: { [SETLIST_ID]: songs.map((song, i) => entryOf(song, i + 1)) },
    endSetlistSession: vi.fn(),
  };
}

export function engineCalls(commands: Record<string, unknown>): string[] {
  return Object.entries(commands).flatMap(([name, command]) =>
    vi.isMockFunction(command) && command.mock.calls.length > 0 ? [name] : [],
  );
}
