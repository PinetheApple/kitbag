import { createElement, type ReactNode } from 'react';
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
  speed: 1,
  scaled: false,
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
  reanalyze: vi.fn(),
  save: vi.fn(() => Promise.resolve(true)),
  dismissMeterNotice: vi.fn(),
};
export const tempo = { correction: 'none' };
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
export const mixer = {
  session: 0,
  opens: 0,
  displaced: 0,
  releases: 0,
};

export function resetScreenState() {
  vi.clearAllMocks();
  display.speed = 1;
  display.scaled = false;
  display.status = 'ready';
  display.song = OPEN_SONG;
  display.analysis = { analysisStatus: 'done', beats: [0] };
  library.rows = [];
  library.failure = null;
  library.files = null;
  meter.override = { meterBeatsPerBar: null, barOneSeconds: null };
  meter.notice = null;
  tempo.correction = 'none';
  songTempo.tempo = null;
  songTempo.mode = null;
  Object.assign(mixer, { session: 0, opens: 0, displaced: 0, releases: 0 });
}

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
});

export async function coreDesignMock(original: <T>() => Promise<T>) {
  const parent = (props: Props) => props.children;
  const nothing = () => null;
  const actual = await original<{
    PLAYER_SCROLL_ID: string;
    usePlayerScroll: () => Record<string, unknown>;
  }>();
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
    Sheet: (props: Props) =>
      props.visible === true
        ? createElement('Sheet', { title: props.title }, props.children)
        : null,
    SectionHeader: (props: Props) => createElement('SectionHeader', props),
    SegmentedControl: (props: Props) =>
      createElement('SegmentedControl', props),
    SheetHint: (props: Props) =>
      createElement('SheetHint', null, props.children),
    Badge: (props: Props) => createElement('Badge', { label: props.label }),
    MenuRow: (props: Props) => createElement('MenuRow', props),
    MeterRow: (props: Props) => createElement('MeterRow', props),
    MeterSheet: (props: Props) => createElement('MeterSheet', props),
    TempoModeRow: (props: Props) => createElement('TempoModeRow', props),
    TempoModeSheet: (props: Props) =>
      props.visible === true ? createElement('TempoModeSheet', props) : null,
    BeatWaveform: nothing,
    Card: parent,
    Chip: () => createElement('Chip'),
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
  return {
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
    useSongLibrary: (select: (state: unknown) => unknown) =>
      select({
        rows: library.rows,
        codes: {},
        reanalyze: commands.reanalyze,
        saveSongMeterOverride: commands.save,
        saveSongTempoCorrection: commands.save,
      }),
    useSongPlayer: (select: (state: unknown) => unknown) =>
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
        ...transport,
      }),
  };
}
