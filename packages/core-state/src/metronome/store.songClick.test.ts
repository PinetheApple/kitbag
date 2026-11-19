import { KB_ACCENT, KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { applyPreset } from '../library/presetMapping.ts';
import { setup as librarySetup } from '../library/store.test-helper.ts';
import type { MetronomeCommands } from './commands.ts';
import {
  createMetronomeStore,
  DEFAULT_BPM,
  type MetronomeConfig,
  type MetronomeStore,
} from './store.ts';

const NOW_FRAME = 0;
const NORMAL_SOUND = 2;
const ACCENT_SOUND = 3;
const EDITED_BEATS = 3;
const EDITED_DENOMINATOR = 8;
const EDITED_SUBDIVISION = 2;
const LAST_BEAT = 3;
const MUTE = { enabled: true, playBars: 2, muteBars: 1 };
const EDITED_ACCENTS = [
  KB_ACCENT.KB_ACCENT_MUTED,
  KB_ACCENT.KB_ACCENT_ACCENTED,
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_ACCENTED,
];

function makeCommands() {
  return {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(),
    metronomeStop: vi.fn(),
    metronomePause: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn(),
    setSubdivision: vi.fn(),
    setSubdivisionAccents: vi.fn(),
    setAccent: vi.fn(),
    setPoly: vi.fn(),
    setPolyAccent: vi.fn(),
    setPolyAgainst: vi.fn(),
    setSounds: vi.fn(),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(),
    engineHold: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    engineRelease: vi.fn(),
  } satisfies MetronomeCommands;
}

type Commands = ReturnType<typeof makeCommands>;

function songClickOver() {
  let running = true;
  const turnOff = () => {
    running = false;
  };
  return { active: () => running, release: vi.fn(turnOff), turnOff };
}

function standalone() {
  const commands = makeCommands();
  const songClick = songClickOver();
  const store = createMetronomeStore(
    commands,
    () => NOW_FRAME,
    () => DEFAULT_BPM,
    Date.now,
    songClick,
  );
  return { commands, songClick, store };
}

interface Edit {
  readonly name: string;
  readonly apply: (metronome: MetronomeStore) => void;
  readonly field: keyof MetronomeConfig;
  readonly sent: (commands: Commands) => ReturnType<typeof vi.fn>;
}

const EDITS: readonly Edit[] = [
  {
    name: 'setSounds',
    apply: (m) => {
      m.setSounds(NORMAL_SOUND, ACCENT_SOUND);
    },
    field: 'sounds',
    sent: (c) => c.setSounds,
  },
  {
    name: 'setAccents',
    apply: (m) => {
      m.setAccents(EDITED_ACCENTS);
    },
    field: 'accents',
    sent: (c) => c.setAccent,
  },
  {
    name: 'cycleAccent',
    apply: (m) => {
      m.cycleAccent(LAST_BEAT);
    },
    field: 'accents',
    sent: (c) => c.setAccent,
  },
  {
    name: 'setBeats',
    apply: (m) => {
      m.setBeats(EDITED_BEATS, EDITED_DENOMINATOR);
    },
    field: 'beatsPerBar',
    sent: (c) => c.setBeats,
  },
];

function lastOrder(mock: { mock: { invocationCallOrder: number[] } }) {
  return mock.mock.invocationCallOrder.at(-1) ?? 0;
}

function expectEngineRuns(commands: Commands, config: MetronomeConfig) {
  expect(commands.setBeats).toHaveBeenLastCalledWith(
    config.beatsPerBar,
    config.denominator,
  );
  config.accents.forEach((accent, beat) => {
    expect(commands.setAccent).toHaveBeenCalledWith(beat, accent);
  });
  expect(commands.setSubdivision).toHaveBeenLastCalledWith(config.subdivision);
  expect(commands.setSounds).toHaveBeenLastCalledWith(
    config.sounds.normal,
    config.sounds.accent,
  );
  expect(commands.setBarMute).toHaveBeenLastCalledWith(
    config.barMute.enabled,
    config.barMute.playBars,
    config.barMute.muteBars,
  );
  const start = lastOrder(commands.metronomeStart);
  expect(start).toBeGreaterThan(0);
  expect(lastOrder(commands.setSounds)).toBeLessThan(start);
  expect(lastOrder(commands.setAccent)).toBeLessThan(start);
}

describe("standalone edits while a song's click runs", () => {
  it.each(EDITS)('$name updates the store but not the engine', (edit) => {
    const { commands, store } = standalone();
    const before = store.getState()[edit.field];
    edit.apply(store.getState());
    expect(store.getState()[edit.field]).not.toEqual(before);
    expect(edit.sent(commands)).not.toHaveBeenCalled();
  });

  it.each(EDITS)('$name reaches the engine with no song click', (edit) => {
    const { commands, songClick, store } = standalone();
    songClick.turnOff();
    edit.apply(store.getState());
    expect(edit.sent(commands)).toHaveBeenCalled();
  });

  it.each(EDITS)(
    '$name plays once the click is off and the standalone starts',
    (edit) => {
      const { commands, songClick, store } = standalone();
      edit.apply(store.getState());
      songClick.turnOff();
      store.getState().start();
      expectEngineRuns(commands, store.getState());
    },
  );

  it('sends the edits when Play releases the click', () => {
    const { commands, songClick, store } = standalone();
    store.getState().setSounds(NORMAL_SOUND, ACCENT_SOUND);
    store.getState().start();
    expect(songClick.release).toHaveBeenCalledOnce();
    expectEngineRuns(commands, store.getState());
  });
});

async function savedPreset() {
  const fixture = librarySetup();
  const source = fixture.metronome.getState();
  source.setSounds(NORMAL_SOUND, ACCENT_SOUND);
  source.setBeats(EDITED_BEATS, EDITED_DENOMINATOR);
  source.setSubdivision(EDITED_SUBDIVISION);
  source.setBarMute(MUTE);
  const id = await fixture.library.getState().newSongFromCurrent('Ballad');
  const preset = fixture.library.getState().presets.find((p) => p.id === id);
  if (preset === undefined) throw new Error('missing preset');
  return preset;
}

const PATTERN_COMMANDS = [
  'setSounds',
  'setAccent',
  'setBeats',
  'setSubdivision',
  'setBarMute',
] as const satisfies readonly (keyof Commands)[];

describe("a preset load while a song's click runs", () => {
  it('updates the store but sends no pattern to the engine', async () => {
    const preset = await savedPreset();
    const { commands, store } = standalone();
    applyPreset(preset, store.getState);
    expect(store.getState()).toMatchObject({
      sounds: { normal: NORMAL_SOUND, accent: ACCENT_SOUND },
      beatsPerBar: EDITED_BEATS,
      subdivision: EDITED_SUBDIVISION,
      barMute: MUTE,
    });
    for (const name of PATTERN_COMMANDS) {
      expect(commands[name]).not.toHaveBeenCalled();
    }
  });

  it('reaches the engine with no song click', async () => {
    const preset = await savedPreset();
    const { commands, songClick, store } = standalone();
    songClick.turnOff();
    applyPreset(preset, store.getState);
    for (const name of PATTERN_COMMANDS) {
      expect(commands[name]).toHaveBeenCalled();
    }
  });

  it('plays the loaded song once the click is off and the standalone starts', async () => {
    const preset = await savedPreset();
    const { commands, songClick, store } = standalone();
    applyPreset(preset, store.getState);
    songClick.turnOff();
    store.getState().start();
    expectEngineRuns(commands, store.getState());
  });
});
