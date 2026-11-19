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

import {
  LOOP_KEY_TEXT,
  REANALYZE_LABEL,
  SPEED_KEY_TEXT,
  SPEED_NOTE,
} from '../logic/viewText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const OPEN_SONG = { songId: 1, title: 'A song', artist: 'An artist', bpm: 120 };
const CLOSED_SONG = { songId: null, title: '', artist: null, bpm: null };

const display = vi.hoisted(() => ({
  scaled: false,
  status: 'ready',
  song: {},
  analysis: { analysisStatus: 'done', beats: [0] as readonly number[] },
}));
const commands = vi.hoisted(() => ({ close: vi.fn(), reanalyze: vi.fn() }));
const transport = vi.hoisted(() => ({
  markLoop: vi.fn(),
  moveLoopEdge: vi.fn(),
  skip: vi.fn(),
  togglePlay: vi.fn(),
  toggleClick: vi.fn(),
}));
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
      h(
        'AppBar',
        {
          actions: props.actions,
          title: props.title,
          subtitle: props.subtitle,
        },
        props.trailing as ReactNode,
      ),
    Button: (props: Props) => h('Button', props),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', null, props.children) : null,
    Badge: (props: Props) => h('Badge', { label: props.label }),
    BeatWaveform: nothing,
    Card: parent,
    Chip: () => h('Chip'),
    createThemedStyles: (build: (theme: unknown) => unknown) => () =>
      build({ color: {} }),
    EmptyState: () => h('EmptyState'),
    PlayerDock: parent,
    PlayerTransport: (props: Props) =>
      h('PlayerTransport', props, props.extraKey as ReactNode),
    Snackbar: (props: Props) => h('Snackbar', props),
    TransportKey: (props: Props) => h('TransportKey', props),
    ScrubRow: nothing,
    textStyle: () => ({}),
    useTextScaled: () => display.scaled,
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const { useFocusedMixerHold, playerSongBadge } = await original<{
    useFocusedMixerHold: unknown;
    playerSongBadge: unknown;
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
    bpmFact: (bpm: number | null) =>
      bpm === null ? null : { text: `${String(bpm)} BPM`, spoken: '' },
    clickKeyLabel: () => '',
    framesToSeconds: () => 0,
    loopEndFrames: () => null,
    loopKeyLabel: () => '',
    SKIP_SECONDS: 10,
    playerSongBadge,
    useFocusedMixerHold,
    useLoopScrub: () => ({}),
    useSongLibrary: (select: (state: unknown) => unknown) =>
      select({ reanalyze: commands.reanalyze }),
    useSongPlayer: (select: (state: unknown) => unknown) =>
      select({
        status: display.status,
        ...display.song,
        click: false,
        ...display.analysis,
        loop: { kind: 'off' },
        open,
        close: commands.close,
        ...transport,
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
  display.song = OPEN_SONG;
  display.analysis = { analysisStatus: 'done', beats: [0] };
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

describe('the app bar while the player leaves after Stop', () => {
  it('keeps the song it was showing once the session closes', () => {
    const tree = mount();
    display.song = CLOSED_SONG;
    display.status = 'idle';
    act(() => {
      tree.update(screen(true));
    });
    const bar = tree.root.findByType('AppBar' as never);
    expect(bar.props).toMatchObject({
      title: OPEN_SONG.title,
      subtitle: OPEN_SONG.artist,
    });
    expect(bar.findAllByType('Badge' as never)).toHaveLength(1);
  });

  it('follows a rename while the song is open', () => {
    const tree = mount();
    display.song = { ...OPEN_SONG, title: 'Renamed' };
    act(() => {
      tree.update(screen(true));
    });
    expect(tree.root.findByType('AppBar' as never).props.title).toBe('Renamed');
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
      (menuButton(tree, REANALYZE_LABEL).props.onPress as () => void)();
    });
    expect(commands.reanalyze).toHaveBeenCalledExactlyOnceWith(1);
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(commands.close).not.toHaveBeenCalled();
  });
});

describe('a song with no beat grid', () => {
  const GRIDLESS = {
    analysing: { analysisStatus: 'analyzing', beats: [] },
    failed: { analysisStatus: 'failed', beats: [] },
    noGrid: { analysisStatus: 'done', beats: [] },
  } as const;

  function barBadge(tree: ReactTestRenderer) {
    return tree.root.findByType('AppBar' as never).findByType('Badge' as never)
      .props.label as unknown;
  }

  function texts(tree: ReactTestRenderer) {
    return tree.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => node.props.children as unknown);
  }

  it.each([
    ['analysing', 'ANALYZING'],
    ['failed', 'NO GRID'],
    ['noGrid', 'NO GRID'],
  ] as const)('badges the bar %s as %s', (state, label) => {
    display.analysis = GRIDLESS[state];
    expect(barBadge(mount())).toBe(label);
  });

  it('badges the bar with the BPM once there is a grid', () => {
    expect(barBadge(mount())).toBe('120 BPM');
  });

  it('keeps the grid badge while a re-analysis runs', () => {
    display.analysis = { analysisStatus: 'analyzing', beats: [0] };
    expect(barBadge(mount())).toBe('120 BPM');
  });

  it.each(['analysing', 'failed', 'noGrid'] as const)(
    'keeps the card but offers no click toggle while %s',
    (state) => {
      display.analysis = GRIDLESS[state];
      const tree = mount();
      expect(tree.root.findAllByType('Chip' as never)).toHaveLength(0);
      expect(texts(tree)).toContain(
        state === 'analysing' ? 'Finding the beat' : 'No beat grid',
      );
    },
  );

  it('re-analyses the song from a failed card', () => {
    display.analysis = GRIDLESS.failed;
    const tree = mount();
    const button = tree.root.find(
      (node) =>
        String(node.type) === 'Button' && node.props.label === REANALYZE_LABEL,
    );
    act(() => {
      (button.props.onPress as () => void)();
    });
    expect(commands.reanalyze).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('offers no Re-analyse while the beat is still being found', () => {
    display.analysis = GRIDLESS.analysing;
    const tree = mount();
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Button' &&
          node.props.label === REANALYZE_LABEL,
      ),
    ).toHaveLength(0);
  });
});

describe('the transport', () => {
  function speedKey(tree: ReactTestRenderer) {
    return tree.root.find(
      (node) =>
        String(node.type) === 'TransportKey' &&
        node.props.text === SPEED_KEY_TEXT,
    );
  }

  it('labels the loop key A|B and marks the loop with it', () => {
    const dock = mount().root.findByType('PlayerTransport' as never);
    expect(dock.props.loopText).toBe(LOOP_KEY_TEXT);
    act(() => {
      (dock.props.onLoop as () => void)();
    });
    expect(transport.markLoop).toHaveBeenCalledOnce();
  });

  it('shows the speed key muted but pressable', () => {
    expect(speedKey(mount()).props).toMatchObject({ muted: true });
    expect(speedKey(mount()).props.disabled).toBeUndefined();
  });

  it('shows the note on a speed tap and sends nothing to the mixer', () => {
    const tree = mount();
    expect(tree.root.findAllByType('Snackbar' as never)).toHaveLength(0);
    act(() => {
      (speedKey(tree).props.onPress as () => void)();
    });
    expect(tree.root.findByType('Snackbar' as never).props.message).toBe(
      SPEED_NOTE,
    );
    for (const command of Object.values(transport))
      expect(command).not.toHaveBeenCalled();
  });

  it('hides the note when it times out', () => {
    const tree = mount();
    act(() => {
      (speedKey(tree).props.onPress as () => void)();
    });
    act(() => {
      (
        tree.root.findByType('Snackbar' as never).props.onTimeout as () => void
      )();
    });
    expect(tree.root.findAllByType('Snackbar' as never)).toHaveLength(0);
  });
});
