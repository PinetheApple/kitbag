import {
  KB_ACCENT,
  KB_MAX_BEATS,
  KB_POLY_BEATS_BOUNDS,
  KB_RESULT,
} from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { applyPreset } from '../library/presetMapping.ts';
import { setup as librarySetup } from '../library/store.test-helper.ts';
import type { MetronomeCommands } from './commands.ts';
import { resizeAccents } from './config.ts';
import {
  createMetronomeStore,
  DEFAULT_BPM,
  initialConfig,
  type MetronomeConfig,
  type MetronomeStore,
} from './store.ts';

const NOW_FRAME = 0;
const NORMAL_SOUND = 2;
const ACCENT_SOUND = 3;
const EDITED_BEATS = 3;
const EDITED_DENOMINATOR = 8;
const EDITED_SUBDIVISION = 2;
const EDITED_POLY_BEATS = 5;
const EDITED_AGAINST = 3;
const FIRST_BEAT = 0;
const LAST_BEAT = 3;
const MUTE = { enabled: true, playBars: 2, muteBars: 1 };
const EDITED_ACCENTS = [
  KB_ACCENT.KB_ACCENT_MUTED,
  KB_ACCENT.KB_ACCENT_ACCENTED,
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_ACCENTED,
];
const EDITED_POLY_ACCENTS = [
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_MUTED,
  KB_ACCENT.KB_ACCENT_ACCENTED,
];

type PatternSource = Pick<
  MetronomeConfig,
  | 'beatsPerBar'
  | 'denominator'
  | 'accents'
  | 'subdivision'
  | 'polyEnabled'
  | 'polyBeats'
  | 'polyAgainst'
  | 'polyAccents'
  | 'sounds'
  | 'barMute'
>;

function patternOf(config: PatternSource) {
  return {
    beatsPerBar: config.beatsPerBar,
    denominator: config.denominator,
    accents: config.accents.slice(0, config.beatsPerBar),
    subdivision: config.subdivision,
    polyEnabled: config.polyEnabled,
    polyBeats: config.polyBeats,
    polyAgainst: config.polyAgainst,
    polyAccents: config.polyAccents.slice(0, config.polyBeats),
    sounds: { ...config.sounds },
    barMute: { ...config.barMute },
  };
}

type Pattern = ReturnType<typeof patternOf>;

function fakeEngine() {
  const initial = initialConfig();
  const applied: Pattern = {
    ...patternOf(initial),
    accents: resizeAccents(initial.accents, KB_MAX_BEATS),
    polyAccents: resizeAccents(initial.polyAccents, KB_POLY_BEATS_BOUNDS.max),
  };
  let atStart: Pattern | null = null;
  const commands = {
    start: vi.fn(() => Promise.resolve(0)),
    metronomeStart: vi.fn(() => {
      atStart = patternOf(applied);
    }),
    metronomeStop: vi.fn(),
    metronomePause: vi.fn(),
    setTempo: vi.fn(),
    setBeats: vi.fn((beats: number, denominator: number) => {
      applied.beatsPerBar = beats;
      applied.denominator = denominator as Pattern['denominator'];
    }),
    setSubdivision: vi.fn((subdivision: number) => {
      applied.subdivision = subdivision;
    }),
    setSubdivisionAccents: vi.fn(),
    setAccent: vi.fn((beat: number, accent: number) => {
      applied.accents[beat] = accent as KB_ACCENT;
    }),
    setPoly: vi.fn((enabled: boolean, beats: number) => {
      applied.polyEnabled = enabled;
      applied.polyBeats = beats;
    }),
    setPolyAccent: vi.fn((beat: number, accent: number) => {
      applied.polyAccents[beat] = accent as KB_ACCENT;
    }),
    setPolyAgainst: vi.fn((against: number) => {
      applied.polyAgainst = against;
    }),
    setSounds: vi.fn((normal: number, accent: number) => {
      applied.sounds = { normal, accent };
    }),
    previewSound: vi.fn(),
    setCountIn: vi.fn(),
    setVolume: vi.fn(),
    setLatencyOffset: vi.fn(),
    setRamp: vi.fn(),
    setBarMute: vi.fn(
      (enabled: boolean, playBars: number, muteBars: number) => {
        applied.barMute = { enabled, playBars, muteBars };
      },
    ),
    engineHold: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    engineRelease: vi.fn(),
  } satisfies MetronomeCommands;
  return {
    commands,
    pattern: () => patternOf(applied),
    atStart: () => atStart,
  };
}

function fakeSongClick({ releaseEndsIt }: { releaseEndsIt: boolean }) {
  let running = true;
  const turnOff = () => {
    running = false;
  };
  const release = vi.fn(releaseEndsIt ? turnOff : () => undefined);
  return { active: () => running, release, turnOff };
}

function standalone({ releaseEndsIt = true } = {}) {
  const engine = fakeEngine();
  const songClick = fakeSongClick({ releaseEndsIt });
  const store = createMetronomeStore(
    engine.commands,
    () => NOW_FRAME,
    () => DEFAULT_BPM,
    Date.now,
    songClick,
  );
  const stored = () => patternOf(store.getState());
  return { engine, songClick, store, stored };
}

interface Edit {
  readonly name: string;
  readonly apply: (metronome: MetronomeStore) => void;
}

const EDITS: readonly Edit[] = [
  {
    name: 'setSounds',
    apply: (m) => {
      m.setSounds(NORMAL_SOUND, ACCENT_SOUND);
    },
  },
  {
    name: 'setAccents',
    apply: (m) => {
      m.setAccents(EDITED_ACCENTS);
    },
  },
  {
    name: 'cycleAccent',
    apply: (m) => {
      m.cycleAccent(LAST_BEAT);
    },
  },
  {
    name: 'setBeats',
    apply: (m) => {
      m.setBeats(EDITED_BEATS, EDITED_DENOMINATOR);
    },
  },
  {
    name: 'setSubdivision',
    apply: (m) => {
      m.setSubdivision(EDITED_SUBDIVISION);
    },
  },
  {
    name: 'setBarMute',
    apply: (m) => {
      m.setBarMute(MUTE);
    },
  },
  {
    name: 'setPoly',
    apply: (m) => {
      m.setPoly(true, EDITED_POLY_BEATS);
    },
  },
  {
    name: 'setPolyAgainst',
    apply: (m) => {
      m.setPolyAgainst(EDITED_AGAINST);
    },
  },
  {
    name: 'cyclePolyAccent',
    apply: (m) => {
      m.cyclePolyAccent(FIRST_BEAT);
    },
  },
  {
    name: 'setPolyAccents',
    apply: (m) => {
      m.setPolyAccents(EDITED_POLY_ACCENTS);
    },
  },
];

function owedAfterLending() {
  const fixture = standalone();
  fixture.songClick.turnOff();
  fixture.engine.commands.setSounds(NORMAL_SOUND, ACCENT_SOUND);
  fixture.store.getState().owePattern();
  return fixture;
}

describe('a pattern owed after a song lent its sounds', () => {
  it('is what the next start plays', () => {
    const { engine, store, stored } = owedAfterLending();
    store.getState().start();
    expect(engine.atStart()).toEqual(stored());
  });

  it('is sent whole by the next edit with the click inactive', () => {
    const { engine, store, stored } = owedAfterLending();
    store.getState().setSubdivision(EDITED_SUBDIVISION);
    expect(engine.pattern()).toEqual(stored());
  });

  it('sends nothing until a start or an edit', () => {
    const { engine, store } = standalone();
    store.getState().owePattern();
    Object.values(engine.commands).forEach((command) => {
      expect(command).not.toHaveBeenCalled();
    });
  });
});

describe("standalone edits while a song's click runs", () => {
  it.each(EDITS)('$name updates the store but not the engine', (edit) => {
    const { engine, store, stored } = standalone();
    const before = engine.pattern();
    edit.apply(store.getState());
    expect(stored()).not.toEqual(before);
    expect(engine.pattern()).toEqual(before);
  });

  it.each(EDITS)('$name reaches the engine with no song click', (edit) => {
    const { engine, songClick, store, stored } = standalone();
    songClick.turnOff();
    edit.apply(store.getState());
    expect(engine.pattern()).toEqual(stored());
  });

  it.each(EDITS)(
    '$name is what the standalone starts on once the click is off',
    (edit) => {
      const { engine, songClick, store, stored } = standalone();
      edit.apply(store.getState());
      songClick.turnOff();
      store.getState().start();
      expect(engine.atStart()).toEqual(stored());
    },
  );

  it('starts on the edits when Play releases the click', () => {
    const { engine, songClick, store, stored } = standalone();
    store.getState().setSounds(NORMAL_SOUND, ACCENT_SOUND);
    store.getState().start();
    expect(songClick.release).toHaveBeenCalledOnce();
    expect(engine.atStart()).toEqual(stored());
  });

  it('starts on the edits when a song count keeps the click active', () => {
    const { engine, songClick, store, stored } = standalone({
      releaseEndsIt: false,
    });
    store.getState().setSounds(NORMAL_SOUND, ACCENT_SOUND);
    store.getState().start();
    expect(songClick.active()).toBe(true);
    expect(engine.atStart()).toEqual(stored());
  });

  it('sends an edit to the running standalone while a song count stays active', () => {
    const { engine, songClick, store, stored } = standalone({
      releaseEndsIt: false,
    });
    store.getState().start();
    store.getState().setSubdivision(EDITED_SUBDIVISION);
    expect(songClick.active()).toBe(true);
    expect(engine.pattern()).toEqual(stored());
  });

  it.each(EDITS)(
    '$name after the click goes off sends the whole held pattern, itself included',
    (edit) => {
      const { engine, songClick, store, stored } = standalone();
      store.getState().setSounds(ACCENT_SOUND, NORMAL_SOUND);
      songClick.turnOff();
      edit.apply(store.getState());
      expect(engine.pattern()).toEqual(stored());
    },
  );

  it('sends the held pattern when playback starts outside start()', () => {
    const { engine, songClick, store, stored } = standalone();
    store.getState().setSounds(NORMAL_SOUND, ACCENT_SOUND);
    songClick.turnOff();
    store.setState({ running: true });
    expect(engine.pattern()).toEqual(stored());
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

describe("a preset load while a song's click runs", () => {
  it('updates the store but not the engine', async () => {
    const preset = await savedPreset();
    const { engine, store, stored } = standalone();
    const before = engine.pattern();
    applyPreset(preset, store.getState);
    expect(store.getState()).toMatchObject({
      sounds: { normal: NORMAL_SOUND, accent: ACCENT_SOUND },
      beatsPerBar: EDITED_BEATS,
      subdivision: EDITED_SUBDIVISION,
      barMute: MUTE,
    });
    expect(stored()).not.toEqual(before);
    expect(engine.pattern()).toEqual(before);
  });

  it('reaches the engine with no song click', async () => {
    const preset = await savedPreset();
    const { engine, songClick, store, stored } = standalone();
    songClick.turnOff();
    applyPreset(preset, store.getState);
    expect(engine.pattern()).toEqual(stored());
  });

  it('is what the standalone starts on once the click is off', async () => {
    const preset = await savedPreset();
    const { engine, songClick, store, stored } = standalone();
    applyPreset(preset, store.getState);
    songClick.turnOff();
    store.getState().start();
    expect(engine.atStart()).toEqual(stored());
  });
});
