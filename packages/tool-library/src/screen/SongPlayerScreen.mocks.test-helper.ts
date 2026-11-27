import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { vi } from 'vitest';

export const OPEN_SONG = {
  songId: 1,
  title: 'A song',
  artist: 'An artist',
  bpm: 120,
};
export const ENGINE_RATE = 48_000;
export const SONG_SECONDS = 200;

export type Props = Record<string, unknown> & {
  readonly children?: ReactNode;
};

export const display = {
  viewing: false,
  playing: null as string | null,
  heldFrame: 0,
  speed: 1,
  scaled: false,
  upNextCount: 0,
  status: 'ready',
  song: {},
  analysis: { analysisStatus: 'done', beats: [0] as readonly number[] },
};
export const library = {
  rows: [] as readonly unknown[],
  failure: null as unknown,
  files: null as unknown,
};
export const commands = {
  close: vi.fn(),
  saveForSong: vi.fn(),
  reanalyze: vi.fn(),
  save: vi.fn(() => Promise.resolve(true)),
  dismissMeterNotice: vi.fn(),
};
export const tempo = { correction: 'none' };
export const manual = {
  tempo: null as unknown,
  analysedBpm: null as number | null,
  offer: null as number | null,
  playheadSeconds: 0,
  setManualTempo: vi.fn(() => Promise.resolve(true)),
  useAnalysedTempo: vi.fn(() => Promise.resolve(true)),
  undoTempo: vi.fn(() => Promise.resolve(true)),
  dismissTempoUndo: vi.fn(),
  dismissAnalysedOffer: vi.fn(),
  previewTempo: vi.fn(),
};
export const songTempo: {
  tempo: unknown;
  mode: unknown;
  setTempoMode: ReturnType<typeof vi.fn>;
} = { tempo: null, mode: null, setTempoMode: vi.fn() };
export const meter: { override: unknown; notice: unknown } = {
  override: { meterBeatsPerBar: null, barOneSeconds: null },
  notice: null,
};
export const transport = {
  markLoop: vi.fn(),
  moveLoopEdge: vi.fn(),
  skip: vi.fn(),
  togglePlay: vi.fn(),
  toggleClick: vi.fn(),
  setSpeed: vi.fn(),
  resetSpeed: vi.fn(),
};
export const queue = {
  playNext: vi.fn(() => Promise.resolve(true)),
  addToQueue: vi.fn(() => Promise.resolve(true)),
};
export const mixer = {
  session: 0,
  opens: 0,
  displaced: 0,
  releases: 0,
};

export function resetScreenState() {
  vi.clearAllMocks();
  display.viewing = false;
  display.playing = null;
  display.speed = 1;
  display.scaled = false;
  display.upNextCount = 0;
  display.status = 'ready';
  display.song = OPEN_SONG;
  display.analysis = { analysisStatus: 'done', beats: [0] };
  library.rows = [];
  library.failure = null;
  library.files = null;
  meter.override = { meterBeatsPerBar: null, barOneSeconds: null };
  meter.notice = null;
  tempo.correction = 'none';
  manual.tempo = null;
  manual.analysedBpm = null;
  manual.offer = null;
  manual.playheadSeconds = 0;
  songTempo.tempo = null;
  songTempo.mode = null;
  Object.assign(mixer, { session: 0, opens: 0, displaced: 0, releases: 0 });
}

function MockSheet(props: Props) {
  const onShow = useRef(props.onShow as (() => void) | undefined);
  useLayoutEffect(() => {
    onShow.current = props.onShow as (() => void) | undefined;
  });
  useEffect(() => {
    if (props.visible === true) onShow.current?.();
  }, [props.visible]);
  return props.visible === true
    ? createElement(
        'Sheet',
        { title: props.title, titleDetail: props.titleDetail },
        props.notice as ReactNode,
        props.children,
      )
    : null;
}

const MANUAL_TEMPO_PARTS = [
  'BeatStrip',
  'ConfirmDialog',
  'Icon',
  'LiveText',
  'NumpadKeypad',
  'NumpadReadout',
  'PlayPauseButton',
  'PresetButton',
  'Stepper',
  'TapLeds',
  'TapPad',
];

const MANUAL_TEMPO_STATE = [
  'constantGrid',
  'GRID_METER',
  'manualBpm',
  'MANUAL_TEMPO_BOUNDS',
  'MINUS',
  'MS_PER_SECOND',
  'pushManualTap',
  'SECONDS_PER_MINUTE',
  'stepManualBpm',
  'TAPS_TO_SET_TEMPO',
  'tappedManualBpm',
  'TEMPO_MIN_ANCHOR_SECONDS',
];

const passthroughs = (names: readonly string[]) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      (props: Props) => createElement(name, props, props.children),
    ]),
  );

export const reactNativeMock = () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
  StyleSheet: { create: <T>(styles: T) => styles },
});

export function clickChipsMock() {
  return {
    SongClickChips: (props: Props) => createElement('SongClickChips', props),
  };
}

export const reanimatedMock = () => ({
  useSharedValue: (value: unknown) => ({ value }),
  useDerivedValue: (derive: () => unknown) => ({ value: derive() }),
});

export async function coreDesignMock(original: <T>() => Promise<T>) {
  const parent = (props: Props) => props.children;
  const nothing = () => null;
  const actual = await original<{
    PLAYER_SCROLL_ID: string;
    usePlayerScroll: () => Record<string, unknown>;
    QUEUE_TEXT: { playNext: string };
    useQueueKeys: (
      presses: unknown,
      queued: boolean,
    ) => { playNext: () => void; addToQueue: () => void; addLabel: string };
  }>();
  const QueueMenuRows = (props: Props) => {
    const keys = actual.useQueueKeys(props.presses, props.queued === true);
    return [
      createElement('MenuRow', {
        key: 'next',
        label: actual.QUEUE_TEXT.playNext,
        onPress: keys.playNext,
      }),
      createElement('MenuRow', {
        key: 'add',
        label: keys.addLabel,
        onPress: keys.addToQueue,
      }),
    ];
  };
  const PlayerScroll = (props: Props) =>
    createElement(
      'ScrollView',
      { testID: actual.PLAYER_SCROLL_ID, ...actual.usePlayerScroll() },
      props.children,
    );
  return {
    ...(await original<Record<string, unknown>>()),
    AppBar: (props: Props) =>
      createElement(
        'AppBar',
        {
          actions: props.actions,
          onBack: props.onBack,
          title: props.title,
          subtitle: props.subtitle,
        },
        props.trailing as ReactNode,
      ),
    Button: (props: Props) => createElement('Button', props),
    Sheet: MockSheet,
    ...passthroughs(MANUAL_TEMPO_PARTS),
    SectionHeader: (props: Props) => createElement('SectionHeader', props),
    SegmentedControl: (props: Props) =>
      createElement('SegmentedControl', props),
    SheetHint: (props: Props) =>
      createElement('SheetHint', null, props.children),
    Badge: (props: Props) => createElement('Badge', { label: props.label }),
    MenuRow: (props: Props) => createElement('MenuRow', props),
    QueueMenuRows,
    MeterRow: (props: Props) => createElement('MeterRow', props),
    MeterSheet: (props: Props) => createElement('MeterSheet', props),
    TempoModeRow: (props: Props) => createElement('TempoModeRow', props),
    TempoModeSheet: (props: Props) =>
      props.visible === true ? createElement('TempoModeSheet', props) : null,
    BeatWaveform: nothing,
    Card: parent,
    Chip: (props: Props) => createElement('Chip', props),
    RowIcon: (props: Props) => createElement('RowIcon', props),
    useTheme: () => ({ accentInk: 'accent' }),
    PickerGrid: nothing,
    BeatLedRow: nothing,
    createThemedStyles: (build: (theme: unknown) => unknown) => () =>
      build({ color: {} }),
    EmptyState: (props: Props) =>
      createElement('EmptyState', { title: props.title, reason: props.reason }),
    PlayerDock: parent,
    PlayerScroll,
    PlayerTransport: (props: Props) =>
      createElement('PlayerTransport', props, props.extraKey as ReactNode),
    Snackbar: (props: Props) => createElement('Snackbar', props),
    TransportKey: (props: Props) => createElement('TransportKey', props),
    SpeedGroup: (props: Props) => createElement('SpeedGroup', props),
    ScrubRow: (props: Props) =>
      createElement('ScrubRow', { loopHandles: props.loopHandles }),
    textStyle: () => ({}),
    useTextScaled: () => display.scaled,
  };
}

export async function coreStateMock(original: <T>() => Promise<T>) {
  const {
    useFocusedMixerHold,
    playerSongBadge,
    beatBeside,
    formatClockSeconds,
    correctedBpm,
    TEMPO_CORRECTION,
    TEMPO_CORRECTIONS,
    formatName,
    joinedFormatNames,
    SOUND_OPTIONS,
    SOUND_ROLE,
    SOUND_ROLE_OPTIONS,
    layoutBeatLeds,
    ledStateFor,
    soundLabel,
    soundPickerLabel,
    soundsWith,
    countInBarsFromOption,
    isUnitySpeed,
    speedHint,
    speedKeyCopy,
    speedPercentText,
    speedPresetTexts,
    steppedSpeed,
    tempoModeLabel,
    tempoSheetView,
    tempoUnavailable,
    TEMPO_MODE,
    TEMPO_SOURCE,
    VIEW_ONLY_REASON,
    viewOnlyReason,
    viewPlayLabel,
  } = await original<{
    useFocusedMixerHold: unknown;
    playerSongBadge: unknown;
    beatBeside: unknown;
    formatClockSeconds: unknown;
    correctedBpm: unknown;
    TEMPO_CORRECTION: unknown;
    TEMPO_CORRECTIONS: unknown;
    formatName: unknown;
    joinedFormatNames: unknown;
    SOUND_OPTIONS: unknown;
    SOUND_ROLE: unknown;
    SOUND_ROLE_OPTIONS: unknown;
    layoutBeatLeds: unknown;
    ledStateFor: unknown;
    soundLabel: unknown;
    soundPickerLabel: unknown;
    soundsWith: unknown;
    countInBarsFromOption: unknown;
    isUnitySpeed: unknown;
    speedHint: unknown;
    speedKeyCopy: unknown;
    speedPercentText: unknown;
    speedPresetTexts: unknown;
    steppedSpeed: unknown;
    tempoModeLabel: unknown;
    tempoSheetView: unknown;
    tempoUnavailable: unknown;
    TEMPO_MODE: unknown;
    TEMPO_SOURCE: unknown;
    VIEW_ONLY_REASON: unknown;
    viewOnlyReason: unknown;
    viewPlayLabel: (title: string, playing: string) => string;
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
  const { createStore } = await import('zustand/vanilla');
  const { createContext } = await import('react');
  const songState = (select: (state: unknown) => unknown) =>
    select({
      status: display.status,
      speed: display.speed,
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
      tempoCorrection: tempo.correction,
      tempo: songTempo.tempo,
      tempoMode: songTempo.mode,
      setTempoMode: songTempo.setTempoMode,
      detectedBpm: 104,
      manualTempo: manual.tempo,
      analysedBpm: manual.analysedBpm,
      analysedOffer: manual.offer,
      setManualTempo: manual.setManualTempo,
      useAnalysedTempo: manual.useAnalysedTempo,
      undoTempo: manual.undoTempo,
      dismissTempoUndo: manual.dismissTempoUndo,
      dismissAnalysedOffer: manual.dismissAnalysedOffer,
      previewTempo: manual.previewTempo,
      tempoPreview: false,
      playheadSeconds: () => manual.playheadSeconds,
      tempoCorrectionChanged: vi.fn(),
      tempoCorrectionSettled: vi.fn(),
      playheadBeatSeconds: () => null,
      clickSettings: {
        countInBars: 0,
        sounds: { normal: 1, accent: 0 },
        accents: [2, 1, 1, 1],
        dirty: false,
      },
      open,
      close: commands.close,
      saveForSong: commands.saveForSong,
      ...transport,
    });
  const actual = await original<Record<string, unknown>>();
  return {
    ...Object.fromEntries(
      MANUAL_TEMPO_STATE.map((name) => [name, actual[name]]),
    ),
    ARRIVAL: { arriving: 'arriving' },
    arrivalStore: createStore(() => ({ arrival: null })),
    GRID_METERS: [3, 4],
    isGridMeter: (meter: number) => [3, 4].includes(meter),
    NO_METER_OVERRIDE: { meterBeatsPerBar: null, barOneSeconds: null },
    analysisFailure: () => library.failure,
    rowFilesOf: () => library.files,
    beatBeside,
    formatClockSeconds,
    correctedBpm,
    TEMPO_CORRECTION,
    TEMPO_CORRECTIONS,
    formatName,
    joinedFormatNames,
    SOUND_OPTIONS,
    SOUND_ROLE,
    SOUND_ROLE_OPTIONS,
    layoutBeatLeds,
    ledStateFor,
    soundLabel,
    soundPickerLabel,
    soundsWith,
    countInBarsFromOption,
    isUnitySpeed,
    speedHint,
    speedKeyCopy,
    speedPercentText,
    speedPresetTexts,
    steppedSpeed,
    tempoModeLabel,
    tempoSheetView,
    tempoUnavailable,
    TEMPO_MODE,
    TEMPO_SOURCE,
    bpmFact: (bpm: number | null) =>
      bpm === null
        ? null
        : {
            value: String(Math.round(bpm)),
            text: `${String(Math.round(bpm))} BPM`,
            spoken: '',
          },
    clickKeyLabel: () => '',
    framesToSeconds: (frames: number, rate: number) => frames / rate,
    loopEndFrames: () => null,
    loopKeyLabel: () => '',
    SKIP_SECONDS: 10,
    playerSongBadge,
    useFocusedMixerHold,
    useLoopScrub: () => ({}),
    useUpNextCount: () => display.upNextCount,
    useSongLibrary: (select: (state: unknown) => unknown) =>
      select({
        rows: library.rows,
        codes: {},
        reanalyze: commands.reanalyze,
        saveSongMeterOverride: commands.save,
        saveSongTempoCorrection: commands.save,
      }),
    useSongPlayer: songState,
    useLiveSongPlayer: songState,
    SongSourceContext: createContext(null),
    useSongSource: () => ({ store: null, viewing: display.viewing }),
    useSongViewing: () => display.viewing,
    useSongHeldFrame: (viewing: boolean) =>
      viewing ? display.heldFrame : null,
    useViewPlayLabel: (title: string, viewing: boolean) =>
      viewing && display.playing !== null
        ? viewPlayLabel(title, display.playing)
        : undefined,
    VIEW_ONLY_REASON,
    viewOnlyReason,
    useIsQueued: () => false,
    useQueueRefresh: () => undefined,
    useQueueSong: () => queue,
  };
}
