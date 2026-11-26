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

const pads = vi.hoisted(() => [] as Props[]);
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
const playAlong = vi.hoisted(() => ({ tap: vi.fn() }));

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
vi.mock('./BpmCard.tsx', () => ({ BpmCard: () => null }));
vi.mock('./NowPlayingCard.tsx', () => ({ NowPlayingCard: () => null }));
vi.mock('./NoSong.tsx', () => ({
  NothingPlaying: () => null,
  NotFollowingRow: () => null,
}));
vi.mock('./playAlongHooks.ts', () => ({
  useSongPositionMs: () => null,
  useTempoLine: () => ({ bpm: null, line: {} }),
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

function tapPad(
  view: (typeof PLAY_ALONG_VIEW)[keyof typeof PLAY_ALONG_VIEW],
  locked = false,
  followed: typeof session | undefined = session,
) {
  pads.length = 0;
  renderToStaticMarkup(
    createElement(PlayAlongBody, {
      view,
      session: view === PLAY_ALONG_VIEW.song ? followed : undefined,
      lock: locked ? lock : undefined,
      onExplainAgain: vi.fn(),
      onOpenTempo: vi.fn(),
    }),
  );
  const [pad] = pads;
  if (pad === undefined) throw new Error('no tap pad drawn');
  return pad as Props & { readonly onTap: () => void };
}

beforeEach(() => {
  vi.clearAllMocks();
  ladder.state.bpm = null;
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

  it('re-locks on a tap once locked', () => {
    ladder.state.bpm = SONG_BPM;
    tapPad(PLAY_ALONG_VIEW.song, true).onTap();
    expect(playAlong.tap).toHaveBeenCalledWith(NOW_MS);
    expect(ladder.state.tap).not.toHaveBeenCalled();
  });

  it('keeps the lock tempo while the followed app is gone', () => {
    ladder.state.bpm = SONG_BPM;
    tapPad(PLAY_ALONG_VIEW.song, true, undefined).onTap();
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
