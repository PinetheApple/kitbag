import {
  KB_COUNT_IN_BARS,
  KB_POLY_AGAINST_BAR,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import type { MetronomeStore } from '../metronome/store.ts';
import {
  applyPreset,
  isLoadedSongUnsaved,
  presetFromMetronome,
  toBlob,
} from './presetMapping.ts';
import { setup } from './store.test-helper.ts';

const RAMP = {
  enabled: true,
  startBpm: 100,
  targetBpm: 140,
  stepBpm: 5,
  interval: 8,
  unit: KB_RAMP_UNIT.KB_RAMP_BARS,
  loop: false,
};

async function loadedSong(engineBpm?: () => number) {
  const fixture = setup(engineBpm);
  const s = fixture.library.getState();
  const id = await s.newSongFromCurrent('Ballad');
  await s.loadSong(id);
  const preset = () => {
    const found = fixture.library.getState().presets.find((p) => p.id === id);
    if (found === undefined) throw new Error('missing song');
    return found;
  };
  const edited = () =>
    isLoadedSongUnsaved(preset(), fixture.metronome.getState());
  return { ...fixture, id, preset, edited };
}

const EDITS: readonly [string, (m: MetronomeStore) => void][] = [
  [
    'tempo',
    (m) => {
      m.setTempo(m.bpm + 1);
    },
  ],
  [
    'meter',
    (m) => {
      m.setBeats(3, 4);
    },
  ],
  [
    'denominator',
    (m) => {
      m.setBeats(m.beatsPerBar, 8);
    },
  ],
  [
    'subdivision',
    (m) => {
      m.setSubdivision(2);
    },
  ],
  [
    'accent',
    (m) => {
      m.cycleAccent(1);
    },
  ],
  [
    'poly',
    (m) => {
      m.setPoly(true, m.polyBeats);
    },
  ],
  [
    'poly beats',
    (m) => {
      m.setPoly(m.polyEnabled, m.polyBeats + 1);
    },
  ],
  [
    'against',
    (m) => {
      m.setPolyAgainst(2);
    },
  ],
  [
    'poly accent',
    (m) => {
      m.cyclePolyAccent(0);
    },
  ],
  [
    'sound',
    (m) => {
      m.setSounds(m.sounds.normal + 1, m.sounds.accent);
    },
  ],
  [
    'accent sound',
    (m) => {
      m.setSounds(m.sounds.normal, m.sounds.accent + 1);
    },
  ],
  [
    'ramp',
    (m) => {
      m.setRamp(RAMP);
    },
  ],
  [
    'bar mute',
    (m) => {
      m.setBarMute({ ...m.barMute, enabled: true });
    },
  ],
  [
    'count-in',
    (m) => {
      m.setCountIn({ ...m.countIn, bars: KB_COUNT_IN_BARS[1] });
    },
  ],
];

describe('isLoadedSongUnsaved', () => {
  it('is false right after a load', async () => {
    const { edited } = await loadedSong();
    expect(edited()).toBe(false);
  });

  it.each(EDITS)('is true after editing the %s', async (_, edit) => {
    const { metronome, edited } = await loadedSong();
    edit(metronome.getState());
    expect(edited()).toBe(true);
  });

  it('is false after Save', async () => {
    const { library, metronome, id, edited } = await loadedSong();
    metronome.getState().setTempo(150);
    await library.getState().saveCurrentInto(id);
    expect(edited()).toBe(false);
  });

  it('ignores volume, latency and the count-in sound, which a song does not store', async () => {
    const { metronome, edited } = await loadedSong();
    const m = metronome.getState();
    m.setVolume(m.volume / 2);
    m.setLatency(m.latencyOffset + 10);
    m.setCountIn({ ...m.countIn, distinct: !m.countIn.distinct });
    expect(edited()).toBe(false);
  });

  it('ignores a ramp moving the live tempo', async () => {
    const { library, metronome, id, edited } = await loadedSong(() => 117);
    metronome.getState().setRamp(RAMP);
    await library.getState().saveCurrentInto(id);
    await library.getState().loadSong(id);
    metronome.getState().start();
    metronome.getState().syncTempoFromEngine();
    expect(metronome.getState().bpm).toBe(117);
    expect(edited()).toBe(false);
  });

  it('reads a fractional song tempo at the precision the engine plays', async () => {
    const fractional = 120.5;
    const { library, metronome, id, edited } = await loadedSong(
      () => fractional,
    );
    await library.getState().savePreset(id, { bpm: fractional });
    await library.getState().loadSong(id);
    metronome.getState().start();
    metronome.getState().stop();
    expect(metronome.getState().bpm).not.toBe(fractional);
    expect(edited()).toBe(false);
  });

  it('marks a subdivision change on a 12/8 song', async () => {
    const { library, metronome, id, edited } = await loadedSong();
    metronome.getState().setBeats(12, 8);
    await library.getState().saveCurrentInto(id);
    expect(edited()).toBe(false);
    metronome.getState().setSubdivision(2);
    expect(edited()).toBe(true);
  });

  it('reads an against count equal to the bar as the bar', async () => {
    const { metronome, preset } = await loadedSong();
    const live = metronome.getState();
    expect(live.polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    const explicit = { ...preset(), polyAgainst: live.beatsPerBar };
    expect(isLoadedSongUnsaved(explicit, live)).toBe(false);
    const liveExplicit = { ...live, polyAgainst: live.beatsPerBar };
    expect(isLoadedSongUnsaved(preset(), liveExplicit)).toBe(false);
  });
});

describe('poly cycle through save and load', () => {
  it('saves the poly cycle with a song and sends it back on load', async () => {
    const { library, metronome, commands } = setup();
    const s = library.getState();
    metronome.getState().setPoly(true, 3);
    metronome.getState().setPolyAgainst(2);
    const explicit = await s.newSongFromCurrent('Three against two');
    metronome.getState().setPolyAgainst(KB_POLY_AGAINST_BAR);
    const bar = await s.newSongFromCurrent('Three against the bar');
    await s.loadSong(explicit);
    expect(metronome.getState().polyAgainst).toBe(2);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(2);
    await s.loadSong(bar);
    expect(metronome.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(
      KB_POLY_AGAINST_BAR,
    );
  });

  it('loads a stored count equal to the song meter as the bar', async () => {
    const { metronome, repos } = setup();
    const song = await repos.presets.create({
      ...presetFromMetronome(metronome.getState()),
      name: 'Waltz',
      beatsPerBar: 3,
      accents: toBlob([1, 1, 1]),
    });
    applyPreset({ ...song, polyAgainst: 3 }, () => metronome.getState());
    expect(metronome.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
  });

  it('applies the meter before the poly cycle on load', async () => {
    const { library, metronome, commands } = setup();
    const s = library.getState();
    metronome.getState().setPolyAgainst(2);
    const song = await s.newSongFromCurrent('Order');
    commands.setBeats.mockClear();
    commands.setPolyAgainst.mockClear();
    await s.loadSong(song);
    const [beats] = commands.setBeats.mock.invocationCallOrder;
    const [against] = commands.setPolyAgainst.mock.invocationCallOrder;
    expect(beats).toBeLessThan(against ?? 0);
  });
});
