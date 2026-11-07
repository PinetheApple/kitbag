import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ scaled: false, status: 'ready' }));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const names = (style: unknown) =>
    [style]
      .flat()
      .filter(Boolean)
      .map((entry) => (entry as { name: string }).name)
      .join(' ');
  const box = (props: Props) =>
    h('div', { 'data-s': names(props.style) }, props.children);
  return { View: box, ScrollView: box, Text: box };
});

vi.mock('@kitbag/core-design', async () => {
  const { createElement: h } = await import('react');
  const parent = (props: Props) => h('div', null, props.children);
  const nothing = () => null;
  return {
    AppBar: (props: Props) => h('header', null, props.trailing as ReactNode),
    Badge: () => h('b', null, 'badge'),
    BeatWaveform: nothing,
    Card: parent,
    Chip: () => h('i', null, 'chip'),
    createThemedStyles: () => () =>
      new Proxy({}, { get: (_, key) => ({ name: String(key) }) }),
    EmptyState: () => h('em', null, 'empty'),
    PlayerDock: nothing,
    PlayerTransport: nothing,
    ScrubRow: nothing,
    screenBar: {},
    songPlayer: {},
    space: {},
    stemPlayer: {},
    textRoles: {},
    textStyle: () => ({}),
    useTextScaled: () => display.scaled,
  };
});

vi.mock('@kitbag/core-state', () => ({
  bpmFact: () => ({ text: '120 BPM', spoken: '120 beats per minute' }),
  clickKeyLabel: () => '',
  framesToSeconds: () => 0,
  loopEndFrames: () => null,
  loopKeyLabel: () => '',
  SKIP_SECONDS: 10,
  songBadge: () => 'grid',
  useFocusedMixerHold: () => undefined,
  useLoopScrub: () => ({}),
  useSongPlayer: (select: (state: unknown) => unknown) =>
    select({
      status: display.status,
      title: 'A song',
      artist: null,
      bpm: 120,
      click: false,
      beats: [0],
      analysisStatus: 'done',
      loop: { kind: 'off' },
    }),
}));

const { SongPlayerScreen } = await import('./SongPlayerScreen.tsx');

const nothing = () => undefined;
const playhead = () => ({}) as never;

function render(status: string, scaled = false): string {
  display.status = status;
  display.scaled = scaled;
  return renderToStaticMarkup(
    createElement(SongPlayerScreen, {
      songId: 1,
      focused: true,
      insets: { top: 0, bottom: 0 },
      onBack: nothing,
      usePlayhead: playhead,
    }),
  );
}

describe('the song player layout', () => {
  it('keeps the click toggle beside the text at the default size', () => {
    const markup = render('ready');
    expect(markup).not.toContain('lockStacked');
    expect(markup).toContain('data-s="lockText"');
  });

  it('stacks the click toggle under the text when scaled', () => {
    const markup = render('ready', true);
    expect(markup).toContain('data-s="lock lockStacked"');
    expect(markup).toContain('data-s="lockTextStacked"');
    expect(markup).not.toContain('data-s="lockText"');
  });

  it('sets the BPM badge in from the bar end', () => {
    expect(render('ready')).toMatch(/data-s="bpm"><b>badge/);
  });

  it.each(['failed', 'missing'])(
    'gives the %s box the screen inset',
    (status) => {
      expect(render(status)).toMatch(/data-s="bodyContent"><em>empty/);
    },
  );
});
