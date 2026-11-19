// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  meterCopy,
  screenBar,
  space,
  type LoopHandles,
} from '@kitbag/core-design';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { METER_FAILED } from '../logic/songMeterText.ts';
import {
  LOOP_KEY_TEXT,
  REANALYZE_LABEL,
  SPEED_KEY_TEXT,
  SPEED_NOTE,
} from '../logic/viewText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const OPEN_SONG = { songId: 1, title: 'A song', artist: 'An artist', bpm: 120 };
const CLOSED_SONG = { songId: null, title: '', artist: null, bpm: null };
const ENGINE_RATE = 48_000;
const SONG_SECONDS = 200;
const DROPPED_FRACTION = 0.25;

const display = vi.hoisted(() => ({
  scaled: false,
  status: 'ready',
  song: {},
  analysis: { analysisStatus: 'done', beats: [0] as readonly number[] },
}));
const library = vi.hoisted(
  (): { rows: readonly unknown[]; failure: unknown } => ({
    rows: [],
    failure: null,
  }),
);
const commands = vi.hoisted(() => ({
  close: vi.fn(),
  reanalyze: vi.fn(),
  save: vi.fn(() => Promise.resolve(true)),
  dismissMeterNotice: vi.fn(),
}));
const meter = vi.hoisted((): { override: unknown; notice: unknown } => ({
  override: { meterBeatsPerBar: null, barOneSeconds: null },
  notice: null,
}));
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
  StyleSheet: { create: <T,>(styles: T) => styles },
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
    MenuRow: (props: Props) => h('MenuRow', props),
    MeterRow: (props: Props) => h('MeterRow', props),
    MeterSheet: (props: Props) => h('MeterSheet', props),
    BeatWaveform: nothing,
    Card: parent,
    Chip: () => h('Chip'),
    createThemedStyles: (build: (theme: unknown) => unknown) => () =>
      build({ color: {} }),
    EmptyState: (props: Props) => h('EmptyState', { reason: props.reason }),
    PlayerDock: parent,
    PlayerTransport: (props: Props) =>
      h('PlayerTransport', props, props.extraKey as ReactNode),
    Snackbar: (props: Props) => h('Snackbar', props),
    TransportKey: (props: Props) => h('TransportKey', props),
    ScrubRow: (props: Props) =>
      h('ScrubRow', { loopHandles: props.loopHandles }),
    textStyle: () => ({}),
    useTextScaled: () => display.scaled,
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const {
    useFocusedMixerHold,
    playerSongBadge,
    beatBeside,
    formatClockSeconds,
  } = await original<{
    useFocusedMixerHold: unknown;
    playerSongBadge: unknown;
    beatBeside: unknown;
    formatClockSeconds: unknown;
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
    GRID_METERS: [3, 4],
    NO_METER_OVERRIDE: { meterBeatsPerBar: null, barOneSeconds: null },
    analysisFailure: () => library.failure,
    beatBeside,
    formatClockSeconds,
    bpmFact: (bpm: number | null) =>
      bpm === null ? null : { text: `${String(bpm)} BPM`, spoken: '' },
    clickKeyLabel: () => '',
    framesToSeconds: (frames: number, rate: number) => frames / rate,
    loopEndFrames: () => null,
    loopKeyLabel: () => '',
    SKIP_SECONDS: 10,
    playerSongBadge,
    useFocusedMixerHold,
    useLoopScrub: () => ({}),
    useSongLibrary: (select: (state: unknown) => unknown) =>
      select({
        rows: library.rows,
        codes: {},
        reanalyze: commands.reanalyze,
        saveSongMeterOverride: commands.save,
      }),
    useSongPlayer: (select: (state: unknown) => unknown) =>
      select({
        status: display.status,
        ...display.song,
        click: false,
        durationFrames: SONG_SECONDS * ENGINE_RATE,
        engineRate: ENGINE_RATE,
        ...display.analysis,
        loop: { kind: 'off' },
        meterOverride: meter.override,
        detected: { meter: 4, barOneSeconds: 2.3 },
        meterNotice: meter.notice,
        dismissMeterNotice: commands.dismissMeterNotice,
        meterOverrideChanged: vi.fn(),
        playheadBeatSeconds: () => null,
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

const UNSUPPORTED = {
  kind: 'unsupported',
  keptGrid: false,
  format: 'ogg',
  supported: ['WAV'],
};
const DAMAGED = { kind: 'damaged', keptGrid: false };
const MISSING = { kind: 'missingFile', keptGrid: false };

function failWith(failure: unknown) {
  library.rows = [{ kind: 'song', id: OPEN_SONG.songId }];
  library.failure = failure;
}
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
  library.rows = [];
  library.failure = null;
  meter.override = { meterBeatsPerBar: null, barOneSeconds: null };
  meter.notice = null;
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

  it('names an unsupported format when the song would not play', () => {
    display.status = 'failed';
    failWith(UNSUPPORTED);
    expect(mount().root.findByType('EmptyState' as never).props.reason).toBe(
      'OGG isn’t supported. Kitbag plays WAV.',
    );
  });

  it('keeps the general reason when the format is not to blame', () => {
    display.status = 'failed';
    failWith(DAMAGED);
    expect(
      mount().root.findByType('EmptyState' as never).props.reason,
    ).toContain('the audio engine did not start');
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
      (node) => String(node.type) === 'MenuRow' && node.props.label === label,
    );
  }

  function menuLabels(tree: ReactTestRenderer) {
    return tree.root
      .findByType('Sheet' as never)
      .findAll((node) => ['MenuRow', 'MeterRow'].includes(String(node.type)))
      .map((node) =>
        String(node.type) === 'MeterRow'
          ? meterCopy.title
          : (node.props.label as unknown),
      );
  }

  function meterRow(tree: ReactTestRenderer) {
    return tree.root.findByType('MeterRow' as never);
  }

  function meterSheet(tree: ReactTestRenderer) {
    return tree.root.findByType('MeterSheet' as never);
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

  it.each([
    ['in an unsupported format', UNSUPPORTED],
    ['whose file is missing', MISSING],
  ])('offers no Re-analyse for a song %s', (_case, failure) => {
    failWith(failure);
    expect(menuLabels(openMenu())).toEqual(['Meter', 'Count-in', 'Stop']);
  });

  it('lists Re-analyse, Meter, Count-in and Stop', () => {
    expect(menuLabels(openMenu())).toEqual([
      REANALYZE_LABEL,
      'Meter',
      'Count-in',
      'Stop',
    ]);
  });

  it('keeps Count-in muted until count-in for songs exists', () => {
    expect(menuButton(openMenu(), 'Count-in').props.disabled).toBe(true);
  });

  it('shows the detected meter, then the override as yours', () => {
    expect(meterRow(openMenu()).props).toMatchObject({
      value: 4,
      yours: false,
      disabled: false,
    });
    meter.override = { meterBeatsPerBar: 3, barOneSeconds: null };
    expect(meterRow(openMenu()).props).toMatchObject({ value: 3, yours: true });
  });

  it('opens the meter sheet from the Meter row and closes the menu', () => {
    const tree = openMenu();
    expect(meterSheet(tree).props.visible).toBe(false);
    act(() => {
      (meterRow(tree).props.onPress as () => void)();
    });
    expect(tree.root.findAllByType('Sheet' as never)).toHaveLength(0);
    expect(meterSheet(tree).props).toMatchObject({
      visible: true,
      options: [3, 4],
      detectedMeter: 4,
      detectedBarOneSeconds: 2.3,
      state: 'ready',
    });
  });

  it('says a meter that could not be saved, once the sheet closes', async () => {
    commands.save.mockResolvedValueOnce(false);
    const tree = openMenu();
    act(() => {
      (meterRow(tree).props.onPress as () => void)();
    });
    await act(async () => {
      (meterSheet(tree).props.onPickMeter as (meter: number) => void)(3);
      await Promise.resolve();
    });
    expect(meterSheet(tree).props.notice).toMatchObject({
      message: 'Could not save the meter.',
      actionLabel: 'Try again',
    });
    act(() => {
      (meterSheet(tree).props.onClose as () => void)();
    });
    const shown = tree.root.findAll(
      (node) =>
        String(node.type) === 'Snackbar' &&
        node.props.message === 'Could not save the meter.',
    );
    expect(shown).toHaveLength(1);
  });

  it.each(['failed', 'missing'])(
    'gives the failed reason when the song is %s',
    (status) => {
      display.status = status;
      expect(meterRow(openMenu()).props).toMatchObject({
        disabled: true,
        reason: METER_FAILED,
      });
    },
  );

  it.each([
    ['analysing', 'analyzing', 'Available once the beat is found'],
    ['failed', 'failed', METER_FAILED],
  ] as const)('disables Meter while %s and says why', (_case, status, why) => {
    display.analysis = { analysisStatus: status, beats: [] };
    expect(meterRow(openMenu()).props).toMatchObject({
      disabled: true,
      reason: why,
    });
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

  it('offers no Re-analyse on the card for an unsupported format', () => {
    display.analysis = GRIDLESS.failed;
    failWith(UNSUPPORTED);
    const tree = mount();
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Button' &&
          node.props.label === REANALYZE_LABEL,
      ),
    ).toHaveLength(0);
  });

  it('says a supported file may be damaged and offers Re-analyse', () => {
    display.analysis = GRIDLESS.failed;
    failWith(DAMAGED);
    const tree = mount();
    expect(texts(tree)).toContain('File may be damaged, so no click');
    expect(
      tree.root.findAll(
        (node) =>
          String(node.type) === 'Button' &&
          node.props.label === REANALYZE_LABEL,
      ),
    ).toHaveLength(1);
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

describe('a re-analysis with an override set', () => {
  function detectedNotes(tree: ReactTestRenderer) {
    return tree.root.findAll(
      (node) =>
        String(node.type) === 'Snackbar' &&
        node.props.actionLabel === meterCopy.useDetected,
    );
  }

  function detectedNote(tree: ReactTestRenderer) {
    const [note] = detectedNotes(tree);
    if (note === undefined) throw new Error('no re-analysis notice');
    return note;
  }

  it('says the override is kept and offers the new result', async () => {
    meter.override = { meterBeatsPerBar: null, barOneSeconds: 105.3 };
    meter.notice = { meter: 3, barOneSeconds: 2.3 };
    const tree = mount();
    const notice = detectedNote(tree);
    expect(notice.props.message).toBe(
      'Re-analysed: 3/4, bar 1 at 0:02.3. Your bar 1 is kept.',
    );
    await act(async () => {
      (notice.props.onAction as () => void)();
      await Promise.resolve();
    });
    expect(commands.dismissMeterNotice).toHaveBeenCalledOnce();
    expect(commands.save).toHaveBeenCalledExactlyOnceWith(1, {
      meterBeatsPerBar: null,
      barOneSeconds: null,
    });
  });

  it('holds the notice while the Meter sheet is open', () => {
    meter.override = { meterBeatsPerBar: 3, barOneSeconds: null };
    meter.notice = { meter: 4, barOneSeconds: 2.3 };
    const tree = mount();
    const [more] = tree.root.findByType('AppBar' as never).props
      .actions as readonly { onPress: () => void }[];
    act(() => {
      more?.onPress();
    });
    act(() => {
      (tree.root.findByType('MeterRow' as never).props.onPress as () => void)();
    });
    expect(detectedNotes(tree)).toHaveLength(0);
    act(() => {
      (
        tree.root.findByType('MeterSheet' as never).props.onClose as () => void
      )();
    });
    expect(detectedNotes(tree)).toHaveLength(1);
  });
});

describe('the loop handles', () => {
  it('moves the dropped edge to its fraction of the song in seconds', () => {
    const row = mount().root.findByType('ScrubRow' as never);
    const handles = row.props.loopHandles as LoopHandles;
    act(() => {
      void handles.onMoveLoopEdge('end', DROPPED_FRACTION);
    });
    expect(transport.moveLoopEdge).toHaveBeenCalledExactlyOnceWith(
      'end',
      DROPPED_FRACTION * SONG_SECONDS,
    );
  });
});
