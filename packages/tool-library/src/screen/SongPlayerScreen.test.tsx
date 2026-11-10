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
const commands = vi.hoisted(() => ({ close: vi.fn(), reanalyze: vi.fn() }));
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
    AppBar: (props: Props) =>
      h('AppBar', { actions: props.actions }, props.trailing as ReactNode),
    Button: (props: Props) => h('Button', props),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', null, props.children) : null,
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
    useSongLibrary: (select: (state: unknown) => unknown) =>
      select({ reanalyze: commands.reanalyze }),
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
        close: commands.close,
      }),
  };
});

const { SongPlayerScreen } = await import('./SongPlayerScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const onBack = vi.fn();
const playhead = () => ({}) as never;

function screen(focused: boolean) {
  return createElement(SongPlayerScreen, {
    songId: 1,
    focused,
    insets: { top: 0, bottom: 0 },
    onBack,
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
  vi.clearAllMocks();
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

describe('a stopped song', () => {
  it('shows no opening note once the song is stopped', () => {
    display.status = 'idle';
    const tree = mount();
    expect(
      tree.root.findAll((node) => String(node.type) === 'Text'),
    ).toHaveLength(0);
  });
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

describe('the player menu', () => {
  function menuButton(tree: ReactTestRenderer, label: string) {
    return tree.root.find(
      (node) => String(node.type) === 'Button' && node.props.label === label,
    );
  }

  function openMenu(): ReactTestRenderer {
    const tree = mount();
    const [more] = tree.root.findByType('AppBar' as never).props
      .actions as readonly { onPress: () => void }[];
    act(() => {
      more?.onPress();
    });
    return tree;
  }

  it('opens from the app bar', () => {
    const tree = mount();
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(openMenu().root.findAllByType('Sheet' as never)).toHaveLength(1);
  });

  it('leaves the player and stops the song', () => {
    const tree = openMenu();
    act(() => {
      (menuButton(tree, 'Stop').props.onPress as () => void)();
    });
    expect(onBack).toHaveBeenCalledOnce();
    expect(commands.close).toHaveBeenCalledOnce();
    expect(onBack.mock.invocationCallOrder[0]).toBeLessThan(
      commands.close.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('re-analyses this song and closes the menu', () => {
    const tree = openMenu();
    act(() => {
      (menuButton(tree, 'Re-analyse').props.onPress as () => void)();
    });
    expect(commands.reanalyze).toHaveBeenCalledExactlyOnceWith(1);
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(commands.close).not.toHaveBeenCalled();
  });
});
