import type { TransportEvent, TransportShowState } from '@kitbag/core-native';
import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';
import {
  libraryStore,
  metronomeStore,
  SONG_STEP,
  type SongStep,
} from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  transportShow: vi.fn<(state: TransportShowState) => void>(),
  transportHide: vi.fn(),
  onTransport: vi.fn<(handler: (event: TransportEvent) => void) => void>(),
}));

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
      subtitle: 'Wedding set · Intro (1/2)',
      index: 0,
      songCount: 2,
    });

    libraryStore.setState({ loaded: loadedAt(1) });
    expect(lastShownSetlist()).toMatchObject({
      subtitle: 'Wedding set · Blackbird (2/2)',
      index: 1,
    });

    const sends = native.transportShow.mock.calls.length;
    libraryStore.setState({ loaded: null });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    expect(lastShownSetlist()).toBeNull();
  });

  it('steps the setlist from the notification, then re-sends the moved song', async () => {
    await import('./transportRuntime');
    const handler = native.onTransport.mock.calls[0]?.[0];
    const stepSong = vi.fn((step: SongStep) => {
      libraryStore.setState({
        loaded: loadedAt(step === SONG_STEP.next ? 1 : 0),
      });
      return Promise.resolve();
    });
    libraryStore.setState({
      setlists: [summary],
      entries: { [SETLIST_ID]: entries },
      loaded: loadedAt(0),
      stepSong,
    });
    metronomeStore.setState({ running: true });
    const notification = {
      playback: 'playing',
      bpm: metronomeStore.getState().bpm,
      rampRunning: false,
      practicePlayedMs: 0,
      practiceStretchStartedAt: 0,
    };

    handler?.({ ...notification, songStep: 'next' });
    expect(stepSong).toHaveBeenLastCalledWith(SONG_STEP.next);
    expect(lastShownSetlist()).toMatchObject({ index: 1 });

    handler?.({ ...notification, songStep: 'previous' });
    expect(stepSong).toHaveBeenLastCalledWith(SONG_STEP.previous);
    expect(lastShownSetlist()).toMatchObject({ index: 0 });

    handler?.({ ...notification, songStep: null });
    expect(stepSong).toHaveBeenCalledTimes(2);
  });

  it('a step while paused sends the new song tempo, and Play keeps it', async () => {
    await import('./transportRuntime');
    const handler = native.onTransport.mock.calls[0]?.[0];
    const stepSong = vi.fn(() => {
      libraryStore.setState({ loaded: loadedAt(1) });
      metronomeStore.setState({ bpm: 90, beatsPerBar: 7, denominator: 8 });
      return Promise.resolve();
    });
    metronomeStore.setState({
      running: true,
      bpm: 120,
      beatsPerBar: 4,
      denominator: 4,
    });
    libraryStore.setState({
      setlists: [summary],
      entries: { [SETLIST_ID]: entries },
      loaded: loadedAt(0),
      stepSong,
    });
    const notification = {
      rampRunning: false,
      practicePlayedMs: 0,
      practiceStretchStartedAt: 0,
      songStep: null,
    };

    handler?.({ ...notification, playback: 'paused', bpm: 120 });
    handler?.({
      ...notification,
      playback: 'paused',
      bpm: 120,
      songStep: 'next',
    });
    const card = native.transportShow.mock.lastCall?.[0];
    expect(card).toMatchObject({
      playing: false,
      bpm: 90,
      beatsPerBar: 7,
      beatUnit: 8,
      setlist: { subtitle: 'Wedding set · Blackbird (2/2)' },
    });

    handler?.({ ...notification, playback: 'playing', bpm: card?.bpm ?? 0 });
    expect(metronomeStore.getState()).toMatchObject({
      running: true,
      bpm: 90,
      beatsPerBar: 7,
    });
  });
});
