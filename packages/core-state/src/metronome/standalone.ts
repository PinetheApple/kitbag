import type { MetronomeConfig, MetronomeStore, RampConfig } from './store.ts';

export const STANDALONE_METRONOME_FIELDS = [
  'bpm',
  'beatsPerBar',
  'denominator',
  'subdivision',
  'accents',
  'polyEnabled',
  'polyBeats',
  'polyAgainst',
  'polyAccents',
  'sounds',
  'ramp',
  'barMute',
] as const satisfies readonly (keyof MetronomeConfig)[];

export type StandaloneMetronome = Pick<
  MetronomeConfig,
  (typeof STANDALONE_METRONOME_FIELDS)[number]
>;

export interface MetronomeSettingsInput extends Omit<
  StandaloneMetronome,
  'denominator'
> {
  readonly denominator: number;
}

export function standaloneMetronomeOf(
  config: MetronomeConfig,
): StandaloneMetronome {
  return {
    bpm: config.bpm,
    beatsPerBar: config.beatsPerBar,
    denominator: config.denominator,
    subdivision: config.subdivision,
    accents: config.accents,
    polyEnabled: config.polyEnabled,
    polyBeats: config.polyBeats,
    polyAgainst: config.polyAgainst,
    polyAccents: config.polyAccents,
    sounds: config.sounds,
    ramp: config.ramp,
    barMute: config.barMute,
  };
}

export function standaloneMetronomeChanged(
  next: MetronomeConfig,
  prev: MetronomeConfig,
): boolean {
  return STANDALONE_METRONOME_FIELDS.some(
    (field) => next[field] !== prev[field],
  );
}

// setTempo switches a ramp off, and switching one off re-reads the engine's
// tempo, which is stale until the engine catches up; so order by ramp state.
function applyTempo(
  bpm: number,
  ramp: RampConfig,
  store: MetronomeStore,
): void {
  if (ramp.enabled) {
    store.setTempo(bpm);
    store.setRamp(ramp);
    return;
  }
  store.setRamp(ramp);
  store.setTempo(bpm);
}

export function applyMetronomeSettings(
  store: MetronomeStore,
  settings: MetronomeSettingsInput,
): void {
  store.setBeats(settings.beatsPerBar, settings.denominator);
  store.setAccents(settings.accents);
  store.setSubdivision(settings.subdivision);
  store.setPoly(settings.polyEnabled, settings.polyBeats);
  store.setPolyAgainst(settings.polyAgainst);
  store.setPolyAccents(settings.polyAccents);
  store.setSounds(settings.sounds.normal, settings.sounds.accent);
  store.setBarMute(settings.barMute);
  applyTempo(settings.bpm, settings.ramp, store);
}
