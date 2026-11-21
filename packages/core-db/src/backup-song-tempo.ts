import { invalidField, type Reader } from './backup-reader';
import { isString } from './guards';
import {
  bundleTempoViolation,
  isTempoMode,
  NO_STORED_TEMPO_COLUMNS,
  storedTempoColumns,
  storedTempoOf,
  TEMPO_COLUMN_OF,
  type TempoColumns,
} from './stem-tempo';

export function readSongTempo(r: Reader, path: string): Partial<TempoColumns> {
  const fields = {
    ...r.presentNullableMember('tempoMode', isString),
    ...r.presentNullableNumber('tempoBpm'),
    ...r.presentNullableNumber('tempoAnchor'),
    ...r.presentNullableCount('tempoBeatsPerBar'),
    ...r.presentNullableMember('tempoSource', isString),
    ...r.presentNullableMember('chosenTempoMode', isString),
  };
  if (Object.keys(fields).length === 0) return {};
  const row = { ...NO_STORED_TEMPO_COLUMNS, ...fields };
  const violation =
    row.tempoMode === null
      ? null
      : bundleTempoViolation({
          mode: row.tempoMode,
          bpm: row.tempoBpm,
          anchor: row.tempoAnchor,
          beatsPerBar: row.tempoBeatsPerBar,
          source: row.tempoSource,
        });
  if (violation)
    invalidField(
      `${path}.${TEMPO_COLUMN_OF[violation.field]}`,
      violation.reason,
    );
  if (row.chosenTempoMode !== null && !isTempoMode(row.chosenTempoMode))
    invalidField(`${path}.chosenTempoMode`, 'expected a tempo mode or null');
  return storedTempoColumns(storedTempoOf(row));
}
