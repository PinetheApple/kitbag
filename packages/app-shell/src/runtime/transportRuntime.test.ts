import type { TransportShowState } from '@kitbag/core-native';
import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';
import { libraryStore, metronomeStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  transportShow: vi.fn<(state: TransportShowState) => void>(),
  transportHide: vi.fn(),
  onTransport: vi.fn(),
}));

// core-state's barrel reaches react-native, expo-haptics and op-sqlite, none of
// which load under node; nothing here touches them.
vi.mock('react-native', () => ({}));
vi.mock('expo-haptics', () => ({}));
vi.mock('@op-engineering/op-sqlite', () => ({}));
vi.mock('./notificationPermission', () => ({
  askForNotificationsOnce: () => undefined,
}));
vi.mock('@kitbag/core-native', async (actual) => ({
  ...(await actual<typeof import('@kitbag/core-native')>()),
  getKitbagCommands: () => native,
}));

const SETLIST_ID = 3;
const entries = ['Intro', 'Blackbird'].map(
  (name, index) =>
    ({
      item: { id: 10 + index },
      preset: { id: 20 + index, name },
    }) as unknown as SetlistEntry,
);
const summary = {
  setlist: { id: SETLIST_ID, name: 'Wedding set', active: true },
  songCount: entries.length,
} as unknown as SetlistSummary;
const loadedAt = (index: number) => ({
  presetId: 20 + index,
  itemId: 10 + index,
  setlistId: SETLIST_ID,
});
const lastShownSetlist = () => native.transportShow.mock.lastCall?.[0].setlist;

describe('transportRuntime', () => {
  it('re-sends the notification as the setlist moves and when it is left', async () => {
    await import('./transportRuntime');
    libraryStore.setState({
      setlists: [summary],
      entries: { [SETLIST_ID]: entries },
      loaded: loadedAt(0),
    });
    metronomeStore.setState({ running: true });
    expect(lastShownSetlist()).toEqual({
      setlistName: 'Wedding set',
      songTitle: 'Intro',
      index: 0,
      songCount: 2,
    });

    libraryStore.setState({ loaded: loadedAt(1) });
    expect(lastShownSetlist()).toMatchObject({
      songTitle: 'Blackbird',
      index: 1,
    });

    const sends = native.transportShow.mock.calls.length;
    libraryStore.setState({ loaded: null });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    expect(lastShownSetlist()).toBeNull();
  });
});
