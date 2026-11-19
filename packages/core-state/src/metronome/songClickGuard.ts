import type { MetronomeCommands } from './commands.ts';
import type { MetronomeConfig } from './store.ts';

export interface SongClickGuard {
  readonly commands: MetronomeCommands;
  readonly restore: (config: MetronomeConfig) => void;
}

// The song's click plays through the one engine metronome's sounds,
// subdivision and bar mute, so the standalone pattern waits for it to go off.
export function guardSongClick(
  commands: MetronomeCommands,
  songClickActive: () => boolean,
): SongClickGuard {
  let held = false;
  const hold =
    <A extends unknown[]>(send: () => (...args: A) => void) =>
    (...args: A) => {
      if (songClickActive()) {
        held = true;
        return;
      }
      send()(...args);
    };
  const passThrough = Object.create(commands) as MetronomeCommands;
  return {
    commands: Object.assign(passThrough, {
      setBeats: hold(() => commands.setBeats),
      setAccent: hold(() => commands.setAccent),
      setSubdivision: hold(() => commands.setSubdivision),
      setPoly: hold(() => commands.setPoly),
      setPolyAgainst: hold(() => commands.setPolyAgainst),
      setPolyAccent: hold(() => commands.setPolyAccent),
      setSounds: hold(() => commands.setSounds),
      setBarMute: hold(() => commands.setBarMute),
    }),
    restore: (config) => {
      if (!held || songClickActive()) return;
      held = false;
      commands.setBeats(config.beatsPerBar, config.denominator);
      config.accents.forEach((accent, beat) => {
        commands.setAccent(beat, accent);
      });
      commands.setSubdivision(config.subdivision);
      commands.setPoly(config.polyEnabled, config.polyBeats);
      commands.setPolyAgainst(config.polyAgainst);
      config.polyAccents.forEach((accent, beat) => {
        commands.setPolyAccent(beat, accent);
      });
      commands.setSounds(config.sounds.normal, config.sounds.accent);
      const { enabled, playBars, muteBars } = config.barMute;
      commands.setBarMute(enabled, playBars, muteBars);
    },
  };
}
