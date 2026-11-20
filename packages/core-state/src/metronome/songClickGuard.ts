import type { MetronomeCommands } from './commands.ts';
import type { MetronomeConfig } from './store.ts';

export interface SongClickGuard {
  readonly commands: MetronomeCommands;
  readonly restore: () => void;
  readonly owe: () => void;
}

// The song's click plays through the one engine metronome's sounds,
// subdivision and bar mute, so the standalone pattern waits for it to go off.
export function guardSongClick(
  commands: MetronomeCommands,
  shouldHold: () => boolean,
  config: () => MetronomeConfig,
): SongClickGuard {
  let held = false;
  const restore = () => {
    if (!held) return;
    held = false;
    const pattern = config();
    commands.setBeats(pattern.beatsPerBar, pattern.denominator);
    pattern.accents.forEach((accent, beat) => {
      commands.setAccent(beat, accent);
    });
    commands.setSubdivision(pattern.subdivision);
    commands.setPoly(pattern.polyEnabled, pattern.polyBeats);
    commands.setPolyAgainst(pattern.polyAgainst);
    pattern.polyAccents.forEach((accent, beat) => {
      commands.setPolyAccent(beat, accent);
    });
    commands.setSounds(pattern.sounds.normal, pattern.sounds.accent);
    const { enabled, playBars, muteBars } = pattern.barMute;
    commands.setBarMute(enabled, playBars, muteBars);
  };
  const hold =
    <A extends unknown[]>(send: (...args: A) => void) =>
    (...args: A) => {
      if (shouldHold()) {
        held = true;
        return;
      }
      if (held) {
        restore();
        return;
      }
      send(...args);
    };
  const guarded: MetronomeCommands = {
    start: (...args) => commands.start(...args),
    metronomeStart: (...args) => {
      commands.metronomeStart(...args);
    },
    metronomeStop: (...args) => {
      commands.metronomeStop(...args);
    },
    metronomePause: (...args) => {
      commands.metronomePause(...args);
    },
    setTempo: (...args) => {
      commands.setTempo(...args);
    },
    setBeats: hold(commands.setBeats),
    setSubdivision: hold(commands.setSubdivision),
    setSubdivisionAccents: (...args) => {
      commands.setSubdivisionAccents(...args);
    },
    setAccent: hold(commands.setAccent),
    setPoly: hold(commands.setPoly),
    setPolyAccent: hold(commands.setPolyAccent),
    setPolyAgainst: hold(commands.setPolyAgainst),
    setSounds: hold(commands.setSounds),
    previewSound: (...args) => {
      commands.previewSound(...args);
    },
    setCountIn: (...args) => {
      commands.setCountIn(...args);
    },
    setVolume: (...args) => {
      commands.setVolume(...args);
    },
    setLatencyOffset: (...args) => {
      commands.setLatencyOffset(...args);
    },
    setRamp: (...args) => {
      commands.setRamp(...args);
    },
    setBarMute: hold(commands.setBarMute),
    engineHold: () => commands.engineHold(),
    engineRelease: () => {
      commands.engineRelease();
    },
  };
  const owe = () => {
    held = true;
  };
  return { commands: guarded, restore, owe };
}
