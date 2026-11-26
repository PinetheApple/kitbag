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
const playAlong = vi.hoisted(() => ({
  tap: vi.fn(() => ({ locked: true })),
  songAheadOfClickMs: undefined as number | undefined,
  sourceGoneAtBoottimeMs: undefined as number | undefined,
}));

vi.mock('@kitbag/core-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  boottimeNowMs: () => NOW_MS,
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
    }),
  );
}

function tapPad(...args: Parameters<typeof draw>) {
  draw(...args);
  const [pad] = pads;
  if (pad === undefined) throw new Error('no tap pad drawn');
  return pad as Props & { readonly onTap: () => void };
}

beforeEach(() => {
  vi.clearAllMocks();
  ladder.state.bpm = null;
  playAlong.songAheadOfClickMs = undefined;
  playAlong.sourceGoneAtBoottimeMs = undefined;
});

describe('the tap pad', () => {
  it('locks the click to the song on one tap once the tempo is known', () => {
    ladder.state.bpm = SONG_BPM;
    tapPad(PLAY_ALONG_VIEW.song).onTap();
    expect(playAlong.tap).toHaveBeenCalledWith(NOW_MS);
    expect(ladder.state.tap).not.toHaveBeenCalled();
  });

  it('counts tap tempo when the song has no tempo yet', () => {
    tapPad(PLAY_ALONG_VIEW.song).onTap();
    expect(ladder.state.tap).toHaveBeenCalledWith(NOW_MS);
    expect(playAlong.tap).not.toHaveBeenCalled();
  });

  it('re-locks on a tap once the lock drifted', () => {
    ladder.state.bpm = SONG_BPM;
    playAlong.songAheadOfClickMs = DRIFT_MS;
    tapPad(PLAY_ALONG_VIEW.song, true).onTap();
    expect(playAlong.tap).toHaveBeenCalledWith(NOW_MS);
    expect(ladder.state.tap).not.toHaveBeenCalled();
  });

  it('is tap tempo with no song to follow', () => {
    ladder.state.bpm = SONG_BPM;
    tapPad(PLAY_ALONG_VIEW.denied).onTap();
    expect(ladder.state.tap).toHaveBeenCalledWith(NOW_MS);
    expect(playAlong.tap).not.toHaveBeenCalled();
  });
});

describe('the drift meter', () => {
  it('takes the pad slot as the last item of the body once locked', () => {
    ladder.state.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song, true);
    expect(order).toEqual(['song', 'bpm', 'pattern', 'meter']);
    expect(pads).toHaveLength(0);
  });

  it('moves to the top and gives the pad back on drift', () => {
    ladder.state.bpm = SONG_BPM;
    playAlong.songAheadOfClickMs = DRIFT_MS;
    draw(PLAY_ALONG_VIEW.song, true);
    expect(order).toEqual(['meter', 'song', 'bpm', 'pattern']);
    expect(pads).toHaveLength(1);
    expect(pads[0]?.copy).toMatchObject({ title: 'Re-tap on a downbeat' });
  });

  it('stays last with no pad while the followed app is gone', () => {
    ladder.state.bpm = SONG_BPM;
    playAlong.songAheadOfClickMs = DRIFT_MS;
    playAlong.sourceGoneAtBoottimeMs = GONE_AT_MS;
    draw(PLAY_ALONG_VIEW.song, true, undefined);
    expect(order).toEqual(['song', 'bpm', 'pattern', 'meter']);
    expect(pads).toHaveLength(0);
  });

  it('is not drawn before a lock', () => {
    ladder.state.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song);
    expect(order).not.toContain('meter');
    expect(pads).toHaveLength(1);
  });
});

describe('the pattern card', () => {
  it('greys the dots while the locked song is paused', () => {
    ladder.state.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song, true, { ...session, playing: false });
    expect(patterns[0]).toMatchObject({ following: true, muted: true });
  });

  it('keeps the dots lit while the click follows', () => {
    ladder.state.bpm = SONG_BPM;
    draw(PLAY_ALONG_VIEW.song, true);
    expect(patterns[0]).toMatchObject({ following: true, muted: false });
  });
});
