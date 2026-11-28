// react-test-renderer is deprecated, but it alone runs effects with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { LibraryRow } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  jsHops,
  runFrame,
} from '../../../core-state/src/testing/reanimatedDriver.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const ROW_ID = 4;
const NEXT_ID = ROW_ID + 1;
const COUNT_END = 48000;
const COUNTING = COUNT_END / 2;
const COUNTED = COUNT_END * 2;

interface Player {
  readonly status: string;
  readonly songId?: number | null;
  readonly setId?: number | null;
  readonly advancedTo?: number | null;
  readonly countEndFrame?: number | null;
}

const now = vi.hoisted(() => ({
  song: {} as Player,
  stem: {} as Player,
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    View: box,
    Pressable: box,
    Text: (props: Props) => h('b', null, props.children),
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const { usePlayingEdge } =
    await import('../../../core-design/src/components/usePlayingEdge.ts');
  return {
    ...(await original<Record<string, unknown>>()),
    usePlayingEdge,
    Badge: () => null,
    EllipsizedText: (props: Props) => h('span', null, props.children),
    libraryList: new Proxy({}, { get: () => 0 }),
    Icon: (props: Props) => h('i', null, `icon:${String(props.name)}`),
    createThemedStyles: () => () =>
      new Proxy({}, { get: (_styles, key) => ({ key }) }),
    useTheme: () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const pure = await original<typeof import('@kitbag/core-state')>();
  return {
    ...pure,
    useShownSongId: () =>
      pure.songShown(now.song as never) ? (now.song.songId ?? null) : null,
    useShownStemSetId: () =>
      pure.stemShown(now.stem as never) ? (now.stem.setId ?? null) : null,
    useSongLibrary: (select: (state: { codes: unknown }) => unknown) =>
      select({ codes: {} }),
    songBadge: () => 'grid',
    analysisFailure: () => null,
    rowFilesOf: () => null,
    useLibrary: () => () => undefined,
    useLiveSongPlayer: (select: (state: unknown) => unknown) =>
      select(now.song),
    useLiveStemPlayer: (select: (state: unknown) => unknown) =>
      select(now.stem),
  };
});

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { LibraryRowView } = await import('./LibraryRowView.tsx');

const STEM_ROW = {
  kind: 'stems',
  id: ROW_ID,
  title: 'Echo',
  artist: 'Charity Gayle',
  durationSec: 30,
  hasGrid: true,
  stemCount: 4,
} as unknown as LibraryRow;

const SONG_ROW = {
  kind: 'song',
  id: ROW_ID,
  title: 'Everlong',
  artist: '',
  durationSec: 30,
  bpm: 120,
  tempoCorrection: 'none',
} as unknown as LibraryRow;

const engine = { mixer_playing: 0, frames_rendered: 0 };
const hostSlot = globalThis as unknown as Record<string, unknown>;
let renderer: ReactTestRenderer | undefined;

const NEXT_STEM_ROW = { ...STEM_ROW, id: NEXT_ID } as LibraryRow;

function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node === null || typeof node !== 'object') return '';
  return textOf((node as { children?: unknown }).children ?? null);
}

function shown(countEndFrame: number | null = null): void {
  now.song = { status: 'ready', songId: ROW_ID, countEndFrame };
  now.stem = { status: 'ready', setId: ROW_ID, countEndFrame };
}

function rows(...shownRows: LibraryRow[]) {
  return shownRows.map((row) =>
    createElement(LibraryRowView, {
      key: row.id,
      row,
      selected: false,
      moving: false,
      onActions: vi.fn(),
      onOpenStemSet: vi.fn(),
      onOpenSong: vi.fn(),
      onUnavailable: vi.fn(),
    }),
  );
}

function mount(...shownRows: LibraryRow[]): string {
  act(() => {
    renderer = create(createElement('div', null, rows(...shownRows)));
  });
  return textOf(renderer?.toJSON() ?? null);
}

function rowTexts(...shownRows: LibraryRow[]): string[] {
  act(() => {
    renderer?.update(createElement('div', null, rows(...shownRows)));
  });
  const list = renderer?.toJSON() as { children?: unknown[] } | null;
  return (list?.children ?? []).map(textOf);
}

function frame(playing: number, rendered = 0): string {
  engine.mixer_playing = playing;
  engine.frames_rendered = rendered;
  act(runFrame);
  return textOf(renderer?.toJSON() ?? null);
}

beforeEach(() => {
  engine.mixer_playing = 0;
  engine.frames_rendered = 0;
  hostSlot[KITBAG_HOST_OBJECT_KEY] = engine;
  now.song = { status: 'idle', songId: null };
  now.stem = { status: 'idle', setId: null };
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  Reflect.deleteProperty(hostSlot, KITBAG_HOST_OBJECT_KEY);
});

const PLAYING = 1;
const STOPPED = 0;

describe('a paused stem song row', () => {
  beforeEach(() => {
    shown();
    mount(STEM_ROW);
  });

  it('says Paused, not Playing', () => {
    const text = frame(STOPPED);
    expect(text).toContain('Paused · 0:30');
    expect(text).not.toContain('Playing');
  });

  it('says Playing again on resume', () => {
    frame(STOPPED);
    expect(frame(PLAYING)).toContain('Playing · 0:30');
  });
});

describe('a paused single song row', () => {
  beforeEach(() => {
    shown();
    mount(SONG_ROW);
  });

  it('shows the play tile and no word', () => {
    const text = frame(STOPPED);
    expect(text).toContain('icon:play');
    expect(text).not.toContain('icon:pause');
    expect(text).not.toMatch(/Paused|Playing/);
  });

  it('shows the pause tile again on resume', () => {
    frame(STOPPED);
    expect(frame(PLAYING)).toContain('icon:pause');
  });
});

describe('a count-in on the current row', () => {
  it('counts as playing for a stem song', () => {
    shown(COUNT_END);
    mount(STEM_ROW);
    expect(frame(STOPPED, COUNTING)).toContain('Playing · 0:30');
    expect(frame(STOPPED, COUNTED)).toContain('Paused · 0:30');
  });

  it('counts as playing for a single song', () => {
    shown(COUNT_END);
    mount(SONG_ROW);
    expect(frame(STOPPED, COUNTING)).toContain('icon:pause');
    expect(frame(STOPPED, COUNTED)).toContain('icon:play');
  });
});

describe('the current row before the first frame', () => {
  it('says Paused straight away for a stem song paused at mount', () => {
    shown();
    expect(mount(STEM_ROW)).toContain('Paused · 0:30');
  });

  it('shows the play tile straight away for a single song paused at mount', () => {
    shown();
    expect(mount(SONG_ROW)).toContain('icon:play');
  });

  it('says Playing straight away for a song playing at mount', () => {
    engine.mixer_playing = PLAYING;
    shown();
    expect(mount(STEM_ROW)).toContain('Playing · 0:30');
  });

  it('says Playing straight away for a song counting in at mount', () => {
    engine.frames_rendered = COUNTING;
    shown(COUNT_END);
    expect(mount(STEM_ROW)).toContain('Playing · 0:30');
  });
});

describe('a track change', () => {
  it('moves the label from the old current row to the new one', () => {
    now.stem = { status: 'ready', setId: ROW_ID };
    engine.mixer_playing = PLAYING;
    mount(STEM_ROW, NEXT_STEM_ROW);
    frame(PLAYING);
    now.stem = { status: 'ready', setId: NEXT_ID };
    engine.mixer_playing = STOPPED;
    const [left, arrived] = rowTexts(STEM_ROW, NEXT_STEM_ROW);
    expect(left).not.toMatch(/Paused|Playing/);
    expect(arrived).toContain('Paused · 0:30');
    expect(frame(PLAYING)).toContain('Playing · 0:30');
  });
});

describe('a row that is not current', () => {
  it('reads no play state and shows the plain row', () => {
    now.song = { status: 'ready', songId: NEXT_ID };
    jsHops.count = 0;
    mount(SONG_ROW);
    expect(frame(PLAYING)).toContain('icon:song');
    expect(jsHops.count).toBe(0);
  });
});
