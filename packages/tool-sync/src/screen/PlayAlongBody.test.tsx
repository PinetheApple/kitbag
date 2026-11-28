import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PLAY_ALONG_VIEW } from '../logic/playAlongView.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: host,
    Pressable: host,
    ScrollView: host,
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

const NOW_MS = 5000;
const TOUCH_UPTIME_MS = 3000;
const DEEP_SLEEP_GAP_MS = 60_000;
const LATER_GAP_MS = 90_000;
const SONG_BPM = 171;
const DRIFT_MS = 38;
const GONE_AT_MS = 4000;

const pads = vi.hoisted(() => [] as Props[]);
const order = vi.hoisted(() => [] as string[]);
const patterns = vi.hoisted(() => [] as Props[]);
const ladder = vi.hoisted(() => ({
  state: {
    bpm: null as number | null,
    source: null as string | null,
    tried: [] as string[],
    looking: false,
    tapsLanded: 0,
    tap: vi.fn(),
  },
}));
const clock = vi.hoisted(() => ({ gapMs: 0 }));
const noTaps = vi.hoisted(() => ({
  step: 'tapping',
  taps: [] as number[],
  offsets: [] as { ms: number; kept: boolean }[],
  result: undefined,
  halfOrDoubleBpm: undefined,
  tempoChoice: undefined as object | undefined,
  movedBeats: 0,
  cleared: undefined,
}));
const playAlong = vi.hoisted(() => ({
  offer: undefined as object | undefined,
  bpm: undefined as number | undefined,
  tapAlong: noTaps,
  tapToLock: vi.fn(() => false),
  forgetClearedTaps: vi.fn(),
  songAheadOfClickMs: undefined as number | undefined,
  sourceGoneAtBoottimeMs: undefined as number | undefined,
}));

vi.mock('@kitbag/core-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  boottimeNowMs: () => NOW_MS,
  uptimeToBoottimeMs: (uptimeMs: number) => uptimeMs + clock.gapMs,
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useTempoLadder: <T,>(selector: (state: typeof ladder.state) => T) =>
    selector(ladder.state),
  tempoLadderStore: { getState: () => ladder.state },
  getPlayAlongStore: () => ({ getState: () => playAlong }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    PlayerScroll: (props: Props) => h('div', null, props.children),
  };
});

vi.mock('./TapPad.tsx', () => ({
  TapPad: (props: Props) => {
    pads.push(props);
    return null;
  },
}));
vi.mock('./BpmCard.tsx', () => ({
  BpmCard: () => {
    order.push('bpm');
    return null;
  },
}));
vi.mock('./NowPlayingCard.tsx', () => ({
  NowPlayingCard: () => {
    order.push('song');
    return null;
  },
}));
vi.mock('./PatternCard.tsx', () => ({
  PatternCard: (props: Props) => {
    order.push('pattern');
    patterns.push(props);
    return null;
  },
}));
vi.mock('./DriftMeter.tsx', () => ({
  DriftMeter: () => {
    order.push('meter');
    return null;
  },
}));
vi.mock('./LibraryOfferCard.tsx', () => ({
  LibraryOfferCard: () => {
    order.push('offer');
    return null;
  },
}));
vi.mock('./TempoChoiceCard.tsx', () => ({
  TempoChoiceCard: () => {
    if (playAlong.tapAlong.tempoChoice !== undefined) order.push('choice');
    return null;
  },
}));
vi.mock('./NoSong.tsx', () => ({
  NothingPlaying: () => null,
  NotFollowingRow: () => null,
}));
vi.mock('./playAlongHooks.ts', () => ({
  useSongPositionMs: () => null,
  useTempoLine: () => ({ bpm: null, line: {} }),
  usePlayAlong: <T,>(selector: (state: typeof playAlong) => T) =>
    selector(playAlong),
}));

const { PlayAlongBody } = await import('./PlayAlongBody.tsx');

const session = {
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

const lock = {
  sessionId: session.sessionId,
  track: { title: session.title, artist: session.artist, durationMs: null },
  downbeatSec: 0,
  bpm: SONG_BPM,
  lockedAtBoottimeMs: 0,
  grid: undefined,
  phaseOffsetMs: 0,
  downbeatShift: 0,
  downbeatShiftAvailable: true,
  gridDownbeats: undefined,
};

function draw(
  view: (typeof PLAY_ALONG_VIEW)[keyof typeof PLAY_ALONG_VIEW],
  locked = false,
  followed: typeof session | undefined = session,
) {
  pads.length = 0;
  order.length = 0;
  patterns.length = 0;
  renderToStaticMarkup(
    createElement(PlayAlongBody, {
      view,
      session: view === PLAY_ALONG_VIEW.song ? followed : undefined,
      lock: locked ? lock : undefined,
      onExplainAgain: vi.fn(),
      onOpenTempo: vi.fn(),
      onOpenMeter: vi.fn(),
      onOpenSubdivision: vi.fn(),
      onOpenPhase: vi.fn(),
    }),
  );
}

function tapPad(...args: Parameters<typeof draw>) {
  draw(...args);
  const [pad] = pads;
  if (pad === undefined) throw new Error('no tap pad drawn');
  return pad as Props & { readonly onTap: (event: unknown) => void };
}

const touch = (timestamp = TOUCH_UPTIME_MS) => ({ nativeEvent: { timestamp } });
const TOUCHED_AT_MS = TOUCH_UPTIME_MS + DEEP_SLEEP_GAP_MS;

beforeEach(() => {
  vi.clearAllMocks();
  ladder.state.bpm = null;
  clock.gapMs = DEEP_SLEEP_GAP_MS;
  playAlong.offer = undefined;
  playAlong.bpm = undefined;
  playAlong.songAheadOfClickMs = undefined;
  playAlong.sourceGoneAtBoottimeMs = undefined;
  playAlong.tapAlong = noTaps;
});

describe('the tap pad', () => {
  it('hands each tap to the tap-along lock once the tempo is known', () => {
    playAlong.bpm = SONG_BPM;
    tapPad(PLAY_ALONG_VIEW.song).onTap(touch());
    expect(playAlong.tapToLock).toHaveBeenCalledWith(TOUCHED_AT_MS);
    expect(ladder.state.tap).not.toHaveBeenCalled();
  });

  it('taps along on the same pad when the song has no tempo yet', () => {
    const pad = tapPad(PLAY_ALONG_VIEW.song);
    pad.onTap(touch());
    expect(pad.copy).toMatchObject({
      hint: 'Your taps set the tempo and the beat. Four or more.',
    });
    expect(playAlong.tapToLock).toHaveBeenCalledWith(TOUCHED_AT_MS);
    expect(ladder.state.tap).not.toHaveBeenCalled();
  });

  it('taps along to re-align once the lock drifted', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.songAheadOfClickMs = DRIFT_MS;
    tapPad(PLAY_ALONG_VIEW.song, true).onTap(touch());
    expect(playAlong.tapToLock).toHaveBeenCalledWith(TOUCHED_AT_MS);
    expect(ladder.state.tap).not.toHaveBeenCalled();
  });

  it('is tap tempo with no song to follow', () => {
    playAlong.bpm = SONG_BPM;
    tapPad(PLAY_ALONG_VIEW.denied).onTap(touch());
    expect(ladder.state.tap).toHaveBeenCalledWith(TOUCHED_AT_MS);
    expect(playAlong.tapToLock).not.toHaveBeenCalled();
  });

  it('stays in the pad slot to ask for the 1 after a fresh lock', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.tapAlong = { ...noTaps, step: 'chooseOne' };
    draw(PLAY_ALONG_VIEW.song, true);
    expect(order).not.toContain('meter');
    expect(pads[0]?.copy).toMatchObject({ title: 'Now tap once on the 1' });
  });

  it('reads the deep-sleep gap again on every tap', () => {
    playAlong.bpm = SONG_BPM;
    const pad = tapPad(PLAY_ALONG_VIEW.song);
    pad.onTap(touch());
    clock.gapMs = LATER_GAP_MS;
    pad.onTap(touch());
    expect(playAlong.tapToLock).toHaveBeenLastCalledWith(
      TOUCH_UPTIME_MS + LATER_GAP_MS,
    );
  });
});

describe('the library offer', () => {
  it('sits between the tempo and the pattern while offered', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.offer = {};
    draw(PLAY_ALONG_VIEW.song);
    expect(order).toEqual(['song', 'bpm', 'offer', 'pattern']);
  });

  it('is not drawn with no offer', () => {
    playAlong.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song);
    expect(order).not.toContain('offer');
  });

  it('tells the pad the grid is on offer', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.offer = {};
    expect(tapPad(PLAY_ALONG_VIEW.song).copy).toMatchObject({
      hint: 'Or tap along to lock it yourself',
    });
  });
});

describe('the tempo choice', () => {
  it('sits between the song and the tempo when the taps disagree', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.tapAlong = { ...noTaps, step: 'chooseTempo', tempoChoice: {} };
    draw(PLAY_ALONG_VIEW.song, true);
    expect(order.slice(0, 3)).toEqual(['song', 'choice', 'bpm']);
  });
});

describe('the drift meter', () => {
  it('takes the pad slot as the last item of the body once locked', () => {
    playAlong.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song, true);
    expect(order).toEqual(['song', 'bpm', 'pattern', 'meter']);
    expect(pads).toHaveLength(0);
  });

  it('moves to the top and gives the pad back on drift', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.songAheadOfClickMs = DRIFT_MS;
    draw(PLAY_ALONG_VIEW.song, true);
    expect(order).toEqual(['meter', 'song', 'bpm', 'pattern']);
    expect(pads).toHaveLength(1);
    expect(pads[0]?.copy).toMatchObject({ title: 'Tap along to re-align' });
  });

  it('stays last with no pad while the followed app is gone', () => {
    playAlong.bpm = SONG_BPM;
    playAlong.songAheadOfClickMs = DRIFT_MS;
    playAlong.sourceGoneAtBoottimeMs = GONE_AT_MS;
    draw(PLAY_ALONG_VIEW.song, true, undefined);
    expect(order).toEqual(['song', 'bpm', 'pattern', 'meter']);
    expect(pads).toHaveLength(0);
  });

  it('is not drawn before a lock', () => {
    playAlong.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song);
    expect(order).not.toContain('meter');
    expect(pads).toHaveLength(1);
  });
});

describe('the pattern card', () => {
  it('greys the dots while the locked song is paused', () => {
    playAlong.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song, true, { ...session, playing: false });
    expect(patterns[0]).toMatchObject({ following: true, muted: true });
  });

  it('keeps the dots lit while the click follows', () => {
    playAlong.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song, true);
    expect(patterns[0]).toMatchObject({ following: true, muted: false });
  });
});
