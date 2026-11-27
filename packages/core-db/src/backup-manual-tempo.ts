import { invalidField, type Reader } from './backup-reader';
import {
  manualTempoColumns,
  manualTempoOf,
  manualTempoViolation,
  NO_MANUAL_TEMPO_COLUMNS,
  type ManualTempoColumns,
} from './manual-tempo';

export function readManualTempo(
  r: Reader,
  path: string,
): Partial<ManualTempoColumns> {
  const fields = {
    ...r.presentNullableNumber('manualTempoBpm'),
    ...r.presentNullableNumber('manualTempoAnchor'),
    ...r.presentNullableCount('manualTempoBeatsPerBar'),
  };
  if (Object.keys(fields).length === 0) return {};
  const columns = { ...NO_MANUAL_TEMPO_COLUMNS, ...fields };
  const violation = manualTempoViolation(columns);
  if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
  return columns;
}

export function storedManualTempoColumns(
  row: Partial<ManualTempoColumns> | undefined,
): ManualTempoColumns {
  return manualTempoColumns(
    manualTempoOf({ ...NO_MANUAL_TEMPO_COLUMNS, ...row }),
  );
}

export function carriesManualTempo(
  record: Partial<ManualTempoColumns>,
): boolean {
  return record.manualTempoBpm !== undefined;
}
