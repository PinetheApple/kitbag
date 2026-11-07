// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { screenBar, space } from '@kitbag/core-design';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ scaled: false, status: 'ready' }));
const mixer = vi.hoisted(() => ({
  session: 0,
  opens: 0,
  displaced: 0,
  releases: 0,
}));

vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const parent = (props: Props) => props.children;
  const nothing = () => null;
  return {
    ...(await original<Record<string, unknown>>()),
    AppBar: (props: Props) => props.trailing as ReactNode,
    Badge: () => h('Badge'),
    BeatWaveform: nothing,
    Card: parent,
    Chip: () => h('Chip'),
    createThemedStyles: (build: (theme: unknown) => unknown) => () =>
      build({ color: {} }),
    EmptyState: () => h('EmptyState'),
    PlayerDock: nothing,
    PlayerTransport: nothing,
    ScrubRow: nothing,
    textStyle: () => ({}),
    useTextScaled: () => display.scaled,
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const { useFocusedMixerHold } = await original<{
    useFocusedMixerHold: unknown;
  }>();
  const open = () => {
    const mine = ++mixer.session;
    mixer.opens++;
    const live = () => mine === mixer.session;
    return {
      hold: {
        live,
        release: () => {
          if (!live()) return;
          mixer.session++;
          mixer.releases++;
        },
      },
    };
  };
  return {
    bpmFact: () => ({ text: '120 BPM', spoken: '120 beats per minute' }),
    clickKeyLabel: () => '',
    framesToSeconds: () => 0,
    loopEndFrames: () => null,
    loopKeyLabel: () => '',
    SKIP_SECONDS: 10,
    songBadge: () => 'grid',
    useFocusedMixerHold,
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
        open,
      }),
  };
});

const { SongPlayerScreen } = await import('./SongPlayerScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const nothing = () => undefined;
const playhead = () => ({}) as never;

function screen(focused: boolean) {
  return createElement(SongPlayerScreen, {
    songId: 1,
    focused,
    insets: { top: 0, bottom: 0 },
    onBack: nothing,
    usePlayhead: playhead,
  });
}

function mount(focused = true): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(screen(focused));
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function styleAround(tree: ReactTestRenderer, type: string) {
  let host: ReactTestInstance | null = tree.root.findByType(
    type as never,
  ).parent;
  while (host !== null && typeof host.type !== 'string') host = host.parent;
  const style: unknown = host?.props.style;
  return Object.assign({}, ...[style].flat(Infinity)) as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  display.scaled = false;
  display.status = 'ready';
  Object.assign(mixer, { session: 0, opens: 0, displaced: 0, releases: 0 });
});

describe('the song player layout', () => {
  it('keeps the click toggle beside the text at the default size', () => {
    expect(styleAround(mount(), 'Chip').flexDirection).toBe('row');
  });

  it('stacks the click toggle under the text when scaled', () => {
    display.scaled = true;
    expect(styleAround(mount(), 'Chip').flexDirection).toBe('column');
  });

  it('sets the BPM badge in from the bar end', () => {
    expect(styleAround(mount(), 'Badge').marginRight).toBe(screenBar.chipEnd);
  });

  it.each(['failed', 'missing'])(
    'gives the %s box the screen inset',
    (status) => {
      display.status = status;
      expect(styleAround(mount(), 'EmptyState').paddingHorizontal).toBe(
        space.screenInset,
      );
    },
  );
});

describe('holding the song', () => {
  it('reopens once after being displaced and balances its holds', () => {
    const tree = mount();
    expect(mixer.opens).toBe(1);
    act(() => {
      tree.update(screen(false));
    });
    mixer.session++;
    mixer.displaced++;
    act(() => {
      tree.update(screen(true));
    });
    expect(mixer.opens).toBe(2);
    act(() => {
      tree.unmount();
    });
    expect(mixer.opens).toBe(mixer.displaced + mixer.releases);
    expect(mixer.releases).toBe(1);
  });
});
