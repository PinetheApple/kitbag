import type { StemMixRecord, StemSongRecord } from './backup-format';
import { asObject, invalidField, reader, type Reader } from './backup-reader';
import type { ClickRate } from './click-rate';
import { stemSetClickViolation } from './click-settings';
import { meterOverrideViolation, type GridMeter } from './meter-override';
import {
  STEM_SET_SOURCE,
  STEM_SET_SOURCES,
  type StemSetSource,
} from './stem-set-source';
import { isTempoMode } from './stem-tempo';

function numbers(r: Reader, key: string, path: string): number[] {
  return r.array(key).map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value))
      invalidField(`${path}.${key}[${String(index)}]`, 'expected a number');
    return value;
  });
}

function text(r: Reader, key: string, path: string): string {
  const value = r.string(key);
  if (value.trim() === '') invalidField(`${path}.${key}`, 'expected text');
  return value;
}

function nullableText(r: Reader, key: string, path: string): string | null {
  return r.nullableString(key) === null ? null : text(r, key, path);
}

function readIdentity(r: Reader, path: string) {
  const source = r.string('source') as StemSetSource;
  if (!STEM_SET_SOURCES.includes(source))
    invalidField(`${path}.source`, 'expected folder or stemdeck');
  const stemdeck = source === STEM_SET_SOURCE.stemdeck;
  const stemdeckJobId = nullableText(r, 'stemdeckJobId', path);
  const uuid = nullableText(r, 'uuid', path);
  if (stemdeck !== (stemdeckJobId !== null))
    invalidField(`${path}.stemdeckJobId`, 'set exactly for a StemDeck song');
  if (stemdeck === (uuid !== null))
    invalidField(`${path}.uuid`, 'set exactly for a folder song');
  return { source, stemdeckJobId, uuid };
}

function readMix(value: unknown, path: string): StemMixRecord {
  const r = reader(value, path);
  const gain = r.number('gain');
  if (gain < 0) invalidField(`${path}.gain`, 'expected a gain ≥ 0');
  return {
    role: text(r, 'role', path),
    name: nullableText(r, 'name', path),
    gain,
    muted: r.boolean('muted'),
    soloed: r.boolean('soloed'),
    pitch: r.number('pitch'),
  };
}

function readMixes(r: Reader, path: string): StemMixRecord[] {
  const mixes = r
    .array('stems')
    .map((value, index) => readMix(value, `${path}.stems[${String(index)}]`));
  const roles = mixes.map(({ role }) => role);
  roles.forEach((role, index) => {
    if (roles.indexOf(role) !== index)
      invalidField(`${path}.stems[${String(index)}].role`, 'repeated role');
  });
  return mixes;
}

function readMeter(r: Reader, path: string) {
  const meter = {
    meterBeatsPerBar: r.nullableCount('meterBeatsPerBar'),
    barOneSeconds: r.nullableNumber('barOneSeconds'),
  };
  const violation = meterOverrideViolation(meter);
  if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
  return meter as typeof meter & { meterBeatsPerBar: GridMeter | null };
}

function readClick(r: Reader, path: string) {
  const click = {
    clickGrouping: numbers(r, 'clickGrouping', path),
    clickRate: r.string('clickRate') as ClickRate,
  };
  const violation = stemSetClickViolation(click);
  if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
  return click;
}

function readPlayback(
  r: Reader,
  object: Record<string, unknown>,
  path: string,
) {
  const speed = r.number('speed');
  if (speed <= 0) invalidField(`${path}.speed`, 'expected a speed above 0');
  const lyricsRetimed =
    object.lyricsRetimed === null ? null : numbers(r, 'lyricsRetimed', path);
  const chosenTempoMode = r.nullableString('chosenTempoMode');
  if (chosenTempoMode !== null && !isTempoMode(chosenTempoMode))
    invalidField(`${path}.chosenTempoMode`, 'expected constant or follow');
  return { speed, lyricsRetimed, chosenTempoMode };
}

export function readStemSong(value: unknown, path: string): StemSongRecord {
  const r = reader(value, path);
  return {
    ...readIdentity(r, path),
    label: r.string('label'),
    title: nullableText(r, 'title', path),
    ...readMeter(r, path),
    ...readPlayback(r, asObject(value, path), path),
    ...readClick(r, path),
    stems: readMixes(r, path),
  };
}
