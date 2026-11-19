import type { TransportEvent, TransportShowState } from '@kitbag/core-native';
import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';
import { libraryStore, metronomeStore } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

type TransportHandler = (event: TransportEvent) => void;

// The runtime subscribes once, at its first import, and vitest clears mock
// history before each test, so the subscriber must outlive vi.fn's record.
const native = vi.hoisted(() => {
  const subscribers: TransportHandler[] = [];
  return {
    transportShow: vi.fn<(state: TransportShowState) => void>(),
    transportHide: vi.fn(),
    onTransport: (handler: TransportHandler) => {
      subscribers.push(handler);
    },
    emitTransport: (event: TransportEvent) => {
      const [handler, ...extra] = subscribers;
      if (handler === undefined || extra.length > 0) {
        throw new Error(
          `expected one transport subscriber, found ${String(subscribers.length)}`,
        );
      }
      handler(event);
    },
  };
});

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
const lastCard = () => native.transportShow.mock.lastCall?.[0];
const lastShownSetlist = () => lastCard()?.setlist;
const notification = {
  rampRunning: false,
  practicePlayedMs: 0,
  practiceStretchStartedAt: 0,
  tempoSet: false,
};

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
    });

    libraryStore.setState({ loaded: loadedAt(1) });
    expect(lastShownSetlist()).toEqual({
      subtitle: 'Wedding set · Blackbird (2/2)',
    });

    const sends = native.transportShow.mock.calls.length;
    const left = { ...summary, setlist: { ...summary.setlist, active: false } };
    libraryStore.setState({ loaded: null, setlists: [left] });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    expect(lastShownSetlist()).toBeNull();
  });

  it('a song change while paused sends the new song tempo, and Play keeps it', async () => {
    await import('./transportRuntime');
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
    });
    native.emitTransport({
      ...notification,
      playback: 'paused',
      bpm: 120,
      cardNumber: lastCard()?.cardNumber ?? 0,
    });
    libraryStore.setState({ loaded: loadedAt(1) });
    metronomeStore.setState({ bpm: 90, beatsPerBar: 7, denominator: 8 });
    const card = lastCard();
    expect(card).toMatchObject({
      playing: false,
      bpm: 90,
      beatsPerBar: 7,
      beatUnit: 8,
      setlist: { subtitle: 'Wedding set · Blackbird (2/2)' },
    });

    native.emitTransport({
      ...notification,
      playback: 'playing',
      bpm: card?.bpm ?? 0,
      cardNumber: card?.cardNumber ?? 0,
    });
    expect(metronomeStore.getState()).toMatchObject({
      running: true,
      bpm: 90,
      beatsPerBar: 7,
    });
  });

  it('a Play before the new song card reaches the service keeps the new tempo', async () => {
    await import('./transportRuntime');
    metronomeStore.setState({ running: true, bpm: 120 });
    const oldSong = lastCard()?.cardNumber ?? 0;
    native.emitTransport({
      ...notification,
      playback: 'paused',
      bpm: 120,
      cardNumber: oldSong,
    });
    metronomeStore.setState({ bpm: 90 });
    const newSong = lastCard()?.cardNumber ?? 0;

    native.emitTransport({
      ...notification,
      playback: 'playing',
      bpm: 120,
      cardNumber: oldSong,
    });
    expect(metronomeStore.getState()).toMatchObject({ running: true, bpm: 90 });
    expect(lastCard()).toMatchObject({ playing: true, bpm: 90 });
    expect(lastCard()?.cardNumber).toBeGreaterThan(newSong);
  });

  it('a Stop from a service on another card hides the card exactly once', async () => {
    const { metronomeTransport } = await import('./transportRuntime');
    metronomeStore.setState({ running: true, bpm: 130 });
    const hides = native.transportHide.mock.calls.length;

    native.emitTransport({
      ...notification,
      playback: 'stopped',
      bpm: 130,
      cardNumber: (lastCard()?.cardNumber ?? 0) - 1,
    });
    expect(native.transportHide).toHaveBeenCalledTimes(hides + 1);
    expect(metronomeTransport.active()).toBe(false);
  });

  it('a service restarted on card 0 gets one resend, then its tempo is taken', async () => {
    await import('./transportRuntime');
    metronomeStore.setState({ running: true, bpm: 100 });
    const sends = native.transportShow.mock.calls.length;

    native.emitTransport({
      ...notification,
      playback: 'paused',
      bpm: 60,
      cardNumber: 0,
    });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    expect(metronomeStore.getState().bpm).toBe(100);

    native.emitTransport({
      ...notification,
      playback: 'playing',
      bpm: 104,
      cardNumber: lastCard()?.cardNumber ?? 0,
    });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    expect(metronomeStore.getState()).toMatchObject({
      running: true,
      bpm: 104,
    });
  });

  it('after an app reload the service tempo is taken until the app sends a card', async () => {
    await import('./transportRuntime');
    metronomeStore.setState({ running: true, bpm: 100 });
    native.emitTransport({
      ...notification,
      playback: 'stopped',
      bpm: 100,
      cardNumber: lastCard()?.cardNumber ?? 0,
    });
    const sends = native.transportShow.mock.calls.length;
    const hides = native.transportHide.mock.calls.length;
    const reloadedAway = 999;

    native.emitTransport({
      ...notification,
      playback: 'playing',
      bpm: 87,
      cardNumber: reloadedAway,
    });
    expect(native.transportShow).toHaveBeenCalledTimes(sends);
    expect(native.transportHide).toHaveBeenCalledTimes(hides);
    expect(metronomeStore.getState()).toMatchObject({ running: true, bpm: 87 });

    metronomeStore.setState({ bpm: 88 });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    native.emitTransport({
      ...notification,
      playback: 'paused',
      bpm: 92,
      cardNumber: lastCard()?.cardNumber ?? 0,
    });
    expect(native.transportShow).toHaveBeenCalledTimes(sends + 1);
    expect(metronomeStore.getState()).toMatchObject({
      running: false,
      bpm: 92,
    });
  });

  it('with the set active and no song loaded, the card shows the chip copy', async () => {
    await import('./transportRuntime');
    metronomeStore.setState({ running: true });
    libraryStore.setState({
      setlists: [summary],
      entries: { [SETLIST_ID]: entries },
      loaded: null,
    });
    expect(lastShownSetlist()).toEqual({ subtitle: 'Wedding set · 2 songs' });
  });
});
