// react-test-renderer is deprecated, but it alone runs effects with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PLAY_ALONG_VIEW } from '../logic/playAlongView.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('host', null, props.children);
  return {
    View: host,
    Text: host,
    Pressable: host,
    ScrollView: host,
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

const SONG_BPM = 171;
const NOW_MS = 5000;

const seen = vi.hoisted(() => ({
  pads: [] as Props[],
  meters: [] as Props[],
  bpmCards: [] as Props[],
  notices: [] as string[],
}));
const playAlong = vi.hoisted(() => ({
  tap: vi.fn(() => ({ locked: true })),
  songAheadOfClickMs: undefined as number | undefined,
  sourceGoneAtBoottimeMs: undefined as number | undefined,
}));
const ladder = vi.hoisted(() => ({
  bpm: 171,
  source: null,
  tried: [],
  looking: false,
  tapsLanded: 0,
  tap: vi.fn(),
}));

vi.mock('@kitbag/core-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  boottimeNowMs: () => NOW_MS,
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useTempoLadder: <T,>(selector: (state: typeof ladder) => T) =>
    selector(ladder),
  tempoLadderStore: { getState: () => ladder },
  getPlayAlongStore: () => ({ getState: () => playAlong }),
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
  Snackbar: (props: Props) => {
    seen.notices.push(props.message as string);
    return null;
  },
}));

vi.mock('./playAlongHooks.ts', () => ({
  useSongPositionMs: () => null,
  useTempoLine: () => ({ bpm: SONG_BPM, line: {} }),
  usePlayAlong: <T,>(selector: (state: typeof playAlong) => T) =>
    selector(playAlong),
}));

const recorder = vi.hoisted(() => (list: Props[]) => (props: Props) => {
  list.push(props);
  return null;
});
vi.mock('./TapPad.tsx', () => ({ TapPad: recorder(seen.pads) }));
vi.mock('./DriftMeter.tsx', () => ({ DriftMeter: recorder(seen.meters) }));
vi.mock('./BpmCard.tsx', () => ({ BpmCard: recorder(seen.bpmCards) }));
vi.mock('./PatternCard.tsx', () => ({ PatternCard: () => null }));
vi.mock('./NowPlayingCard.tsx', () => ({ NowPlayingCard: () => null }));
vi.mock('./NoSong.tsx', () => ({
  NothingPlaying: () => null,
  NotFollowingRow: () => null,
}));

const { PlayAlongBody } = await import('./PlayAlongBody.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const firstSong = {
  sessionId: 'spotify',
  packageName: 'spotify',
  appLabel: 'Spotify',
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  durationMs: null,
  playing: true,
  positionMs: 0,
  positionUpdatedAtMs: 0,
  speed: 1,
  spokenWord: false,
};
const nextSong = { ...firstSong, title: 'Levitating', artist: 'Dua Lipa' };

const lockOn = (song: typeof firstSong, at: number) => ({
  sessionId: song.sessionId,
  track: { title: song.title, artist: song.artist, durationMs: null },
  downbeatSec: 0,
  bpm: SONG_BPM,
  lockedAtBoottimeMs: at,
  grid: undefined,
});

type Session = typeof firstSong | undefined;
type Lock = ReturnType<typeof lockOn> | undefined;

let renderer: ReactTestRenderer | null = null;

function element(session: Session, lock: Lock) {
  return createElement(PlayAlongBody, {
    view: PLAY_ALONG_VIEW.song,
    session,
    lock,
    onExplainAgain: vi.fn(),
    onOpenTempo: vi.fn(),
    onOpenMeter: vi.fn(),
    onOpenSubdivision: vi.fn(),
  });
}

function clear() {
  seen.pads.length = 0;
  seen.meters.length = 0;
  seen.bpmCards.length = 0;
}

async function show(session: Session, lock: Lock) {
  clear();
  await act(async () => {
    if (renderer === null) renderer = create(element(session, lock));
    else renderer.update(element(session, lock));
    await Promise.resolve();
  });
}

async function press(props: Props | undefined, key: string) {
  const handler = props?.[key] as () => void;
  clear();
  await act(async () => {
    handler();
    await Promise.resolve();
  });
}

const lastPad = () => seen.pads.at(-1);
const lastMeter = () => seen.meters.at(-1);

beforeEach(() => {
  vi.clearAllMocks();
  renderer = null;
  seen.notices.length = 0;
  playAlong.songAheadOfClickMs = undefined;
  playAlong.sourceGoneAtBoottimeMs = undefined;
});

describe('re-tap from the drift meter', () => {
  it('brings the pad back, re-locks on a tap and gives the slot back on lift', async () => {
    const first = lockOn(firstSong, 0);
    await show(firstSong, first);
    expect(seen.pads).toHaveLength(0);

    await press(lastMeter(), 'onRetap');
    expect(lastPad()?.copy).toMatchObject({ title: 'Re-tap on a downbeat' });

    await press(lastPad(), 'onTap');
    expect(playAlong.tap).toHaveBeenCalledWith(NOW_MS);
    await show(firstSong, lockOn(firstSong, NOW_MS));
    expect(lastPad()?.copy).toMatchObject({ title: 'Locked on beat 1' });

    await press(lastPad(), 'onRelease');
    expect(seen.pads).toHaveLength(0);
    expect(seen.meters.length).toBeGreaterThan(0);
  });

  it('forgets a re-tap when the lock drops', async () => {
    await show(firstSong, lockOn(firstSong, 0));
    await press(lastMeter(), 'onRetap');
    await show(firstSong, undefined);
    await show(firstSong, lockOn(firstSong, NOW_MS));
    expect(seen.pads).toHaveLength(0);
  });

  it('never offers the re-tap pad while the song is paused', async () => {
    const held = lockOn(firstSong, 0);
    await show(firstSong, held);
    await press(lastMeter(), 'onRetap');
    expect(seen.pads).toHaveLength(1);
    await show({ ...firstSong, playing: false }, held);
    expect(seen.pads).toHaveLength(0);
  });
});

describe('a lock that ends', () => {
  it('names the new track and says the click stopped when the song changes', async () => {
    await show(firstSong, lockOn(firstSong, 0));
    await show(nextSong, undefined);
    expect(seen.bpmCards.at(-1)).toMatchObject({ newTrack: true });
    expect(seen.notices).toEqual([
      'New track. The click stopped until you tap.',
    ]);
  });

  it('says nothing when the followed app went away', async () => {
    await show(firstSong, lockOn(firstSong, 0));
    await show(undefined, undefined);
    expect(seen.bpmCards.at(-1)).toMatchObject({ newTrack: false });
    expect(seen.notices).toEqual([]);
  });

  it('drops the new-track badge once the next song is locked', async () => {
    await show(firstSong, lockOn(firstSong, 0));
    await show(nextSong, undefined);
    await show(nextSong, lockOn(nextSong, NOW_MS));
    expect(seen.bpmCards.at(-1)).toMatchObject({ newTrack: false });
  });
});
