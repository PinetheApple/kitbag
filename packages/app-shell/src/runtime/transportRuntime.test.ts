import type { TransportEvent, TransportShowState } from '@kitbag/core-native';
import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';
import { libraryStore, metronomeStore, mixerClick } from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

type TransportHandler = (event: TransportEvent) => void;

// The runtime subscribes once, at its first import, and vitest clears mock
// history before each test, so the subscriber must outlive vi.fn's record.
const native = vi.hoisted(() => {
  const subscribers: TransportHandler[] = [];
  const cardCalls: string[] = [];
  const logged = (name: string) =>
    vi.fn(() => {
      cardCalls.push(name);
    });
  return {
    cardCalls,
    transportShow: vi.fn<(state: TransportShowState) => void>(() => {
      cardCalls.push('metronome show');
    }),
    transportHide: logged('metronome hide'),
    songTransportShow: logged('song show'),
    songTransportHide: logged('song hide'),
    metronomeStart: vi.fn(),
    metronomePause: vi.fn(),
    metronomeStop: vi.fn(),
    setTempo: vi.fn<(bpm: number) => void>(),
    host: { frames_rendered: 0, current_bpm: Number.NaN },
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
  getKitbagHostObject: () => native.host,
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
  action: 'play',
  tempoStep: 0,
  engineBpm: Number.NaN,
};
const TEMPO_STEP = 1;
const calls = (command: { mock: { calls: unknown[] } }) =>
  command.mock.calls.length;

function pausedByTheService(bpm: number): number {
  metronomeStore.getState().stop();
  metronomeStore.setState({ running: true, bpm });
  const held = lastCard()?.cardNumber ?? 0;
  native.emitTransport({
    ...notification,
    action: 'pause',
    playback: 'paused',
    bpm,
    cardNumber: held,
  });
  return held;
}

function playingOnACurrentCard(bpm: number): number {
  metronomeStore.getState().stop();
  metronomeStore.setState({ running: true, bpm });
  return lastCard()?.cardNumber ?? 0;
}

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
      action: 'pause',
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
      action: 'pause',
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
      action: 'stop',
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
      action: 'pause',
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
      action: 'stop',
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
      action: 'pause',
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

  it('a Pause that beats the app Play to the service pauses the click', async () => {
    await import('./transportRuntime');
    const held = pausedByTheService(120);
    metronomeStore.getState().start();
    const pauses = calls(native.metronomePause);

    native.emitTransport({
      ...notification,
      action: 'pause',
      playback: 'paused',
      bpm: 120,
      cardNumber: held,
    });
    expect(native.metronomePause).toHaveBeenCalledTimes(pauses + 1);
    expect(metronomeStore.getState().running).toBe(false);
    expect(lastCard()).toMatchObject({ playing: false, bpm: 120 });
  });

  it('a Play that beats the app Pause to the service starts the click', async () => {
    await import('./transportRuntime');
    const held = playingOnACurrentCard(120);
    metronomeStore.getState().pause();
    const starts = calls(native.metronomeStart);

    native.emitTransport({
      ...notification,
      action: 'play',
      playback: 'playing',
      bpm: 120,
      cardNumber: held,
    });
    expect(native.metronomeStart).toHaveBeenCalledTimes(starts + 1);
    expect(metronomeStore.getState().running).toBe(true);
    expect(lastCard()).toMatchObject({ playing: true, bpm: 120 });
  });

  it('a tempo step that beats the new song card steps from the new song tempo', async () => {
    await import('./transportRuntime');
    const held = pausedByTheService(120);
    metronomeStore.setState({ bpm: 90 });

    native.emitTransport({
      ...notification,
      action: 'tempo_up',
      tempoStep: TEMPO_STEP,
      playback: 'paused',
      bpm: 121,
      cardNumber: held,
    });
    expect(metronomeStore.getState()).toMatchObject({
      running: false,
      bpm: 91,
    });
    expect(native.setTempo).toHaveBeenLastCalledWith(91);
    expect(lastCard()).toMatchObject({ playing: false, bpm: 91 });
  });

  it('an event that beats a practice reset to the service keeps the reset', async () => {
    await import('./transportRuntime');
    metronomeStore.getState().stop();
    metronomeStore.setState({
      running: true,
      bpm: 120,
      practice: { playedMs: 60_000, stretchStartedAt: Date.now() },
    });
    const held = lastCard()?.cardNumber ?? 0;
    metronomeStore.getState().resetPractice();

    native.emitTransport({
      ...notification,
      action: 'play',
      playback: 'playing',
      bpm: 120,
      practicePlayedMs: 60_000,
      cardNumber: held,
    });
    expect(metronomeStore.getState().practice.playedMs).toBe(0);
    expect(lastCard()?.practicePlayedMs).toBe(0);
  });

  it('a stale step while playing moves the store exactly one step, even once the engine has it', async () => {
    await import('./transportRuntime');
    const held = playingOnACurrentCard(120);
    metronomeStore.setState({ beatsPerBar: 3 });
    native.host.current_bpm = 121;

    native.emitTransport({
      ...notification,
      action: 'tempo_up',
      tempoStep: TEMPO_STEP,
      playback: 'playing',
      bpm: 121,
      engineBpm: 120,
      cardNumber: held,
    });
    native.host.current_bpm = Number.NaN;
    expect(metronomeStore.getState().bpm).toBe(121);
    expect(native.setTempo).toHaveBeenLastCalledWith(121);
    expect(lastCard()).toMatchObject({ playing: true, bpm: 121 });
  });

  it('a stale step from a paused card during an app ramp steps from the ramp tempo', async () => {
    await import('./transportRuntime');
    const held = pausedByTheService(120);
    const ramp = metronomeStore.getState().ramp;
    metronomeStore.setState({ ramp: { ...ramp, enabled: true }, bpm: 95 });
    metronomeStore.getState().start();

    native.emitTransport({
      ...notification,
      action: 'tempo_up',
      tempoStep: TEMPO_STEP,
      playback: 'paused',
      bpm: 121,
      engineBpm: 100.4,
      cardNumber: held,
    });
    expect(metronomeStore.getState()).toMatchObject({
      running: true,
      bpm: 101,
      ramp: { enabled: false },
    });
    expect(native.setTempo).toHaveBeenLastCalledWith(101);
  });

  it('two stale steps from two queued cards each move one step from the app tempo', async () => {
    await import('./transportRuntime');
    const held = pausedByTheService(120);
    metronomeStore.setState({ bpm: 90 });
    const queued = lastCard()?.cardNumber ?? 0;
    metronomeStore.setState({ bpm: 95 });

    native.emitTransport({
      ...notification,
      action: 'tempo_up',
      tempoStep: TEMPO_STEP,
      playback: 'paused',
      bpm: 121,
      cardNumber: held,
    });
    native.emitTransport({
      ...notification,
      action: 'tempo_up',
      tempoStep: TEMPO_STEP,
      playback: 'paused',
      bpm: 91,
      cardNumber: queued,
    });
    expect(metronomeStore.getState()).toMatchObject({
      running: false,
      bpm: 97,
    });
    expect(native.setTempo).toHaveBeenLastCalledWith(97);
    expect(lastCard()).toMatchObject({ playing: false, bpm: 97 });
  });

  it('a stale event with an action the app does not know takes the service result', async () => {
    await import('./transportRuntime');
    const held = pausedByTheService(120);
    metronomeStore.setState({ bpm: 90 });
    const sent = lastCard()?.cardNumber ?? 0;

    native.emitTransport({
      ...notification,
      action: 'rewind',
      playback: 'playing',
      bpm: 130,
      cardNumber: held,
    });
    expect(metronomeStore.getState()).toMatchObject({
      running: true,
      bpm: 130,
    });
    expect(lastCard()).toMatchObject({ playing: true, bpm: 130 });
    expect(lastCard()?.cardNumber).toBeGreaterThan(sent);
  });

  it('a stale Play after a song took the card stops the click and leaves the song card shown', async () => {
    const { metronomeTransport } = await import('./transportRuntime');
    const held = playingOnACurrentCard(120);
    metronomeTransport.release();
    native.songTransportShow();
    const cardsBefore = [...native.cardCalls];
    const stops = calls(native.metronomeStop);

    native.emitTransport({
      ...notification,
      action: 'play',
      playback: 'playing',
      bpm: 120,
      cardNumber: held,
    });
    expect(native.cardCalls).toEqual(cardsBefore);
    expect(native.cardCalls.at(-1)).toBe('song show');
    expect(native.metronomeStop).toHaveBeenCalledTimes(stops + 1);
    expect(metronomeStore.getState().running).toBe(false);
  });

  it('a stale Play after a song took the card leaves the song click alone', async () => {
    const { metronomeTransport } = await import('./transportRuntime');
    const held = playingOnACurrentCard(120);
    metronomeTransport.release();
    const songClick = {
      running: () => true,
      title: () => 'Blackbird',
      turnOff: () => undefined,
    };
    mixerClick.attach(songClick);
    const cardsBefore = [...native.cardCalls];
    const stops = calls(native.metronomeStop);

    native.emitTransport({
      ...notification,
      action: 'play',
      playback: 'playing',
      bpm: 120,
      cardNumber: held,
    });
    mixerClick.detach(songClick);
    expect(native.cardCalls).toEqual(cardsBefore);
    expect(native.metronomeStop).toHaveBeenCalledTimes(stops);
  });
});
