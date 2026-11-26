import type { MetronomeCommands } from './commands.ts';

export interface EngineYield {
  readonly commands: MetronomeCommands;
  readonly yieldEngine: () => () => void;
  readonly yielded: () => boolean;
}

const TRANSPORT_KEY = 'transport';

// While another slot is selected every command would land on it, so the
// standalone store's commands wait and only the latest per setting is sent back.
export function yieldableCommands(commands: MetronomeCommands): EngineYield {
  let yields = 0;
  const owed = new Map<string, () => void>();
  const later =
    <A extends unknown[]>(
      key: (args: A) => string,
      send: (...args: A) => void,
    ) =>
    (...args: A) => {
      if (yields === 0) {
        send(...args);
        return;
      }
      const owedKey = key(args);
      owed.delete(owedKey);
      owed.set(owedKey, () => {
        send(...args);
      });
    };
  const named = (name: string) => () => name;
  const byFirst =
    (name: string) =>
    (args: readonly unknown[]): string =>
      `${name}:${String(args[0])}`;
  const transport = named(TRANSPORT_KEY);
  const settle = () => {
    const pending = [...owed.values()];
    owed.clear();
    for (const send of pending) send();
  };
  return {
    commands: {
      start: () => commands.start(),
      metronomeStart: (...args) => {
        commands.metronomeStart(...args);
      },
      metronomeStop: later(transport, commands.metronomeStop),
      metronomePause: later(transport, commands.metronomePause),
      setTempo: later(named('tempo'), commands.setTempo),
      setBeats: later(named('beats'), commands.setBeats),
      setSubdivision: later(named('subdivision'), commands.setSubdivision),
      setSubdivisionAccents: later(
        byFirst('subdivisionAccents'),
        commands.setSubdivisionAccents,
      ),
      setAccent: later(byFirst('accent'), commands.setAccent),
      setPoly: later(named('poly'), commands.setPoly),
      setPolyAccent: later(byFirst('polyAccent'), commands.setPolyAccent),
      setPolyAgainst: later(named('polyAgainst'), commands.setPolyAgainst),
      setSounds: later(named('sounds'), commands.setSounds),
      previewSound: (...args) => {
        if (yields === 0) commands.previewSound(...args);
      },
      setCountIn: later(named('countIn'), commands.setCountIn),
      setVolume: later(named('volume'), commands.setVolume),
      setLatencyOffset: later(named('latency'), commands.setLatencyOffset),
      setRamp: later(named('ramp'), commands.setRamp),
      setBarMute: later(named('barMute'), commands.setBarMute),
      engineHold: () => commands.engineHold(),
      engineRelease: () => {
        commands.engineRelease();
      },
    },
    yieldEngine: () => {
      yields++;
      let returned = false;
      return () => {
        if (returned) return;
        returned = true;
        yields--;
        if (yields === 0) settle();
      };
    },
    yielded: () => yields > 0,
  };
}
