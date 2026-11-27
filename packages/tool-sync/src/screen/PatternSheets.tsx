import { SubdivisionSheet, TimeSignatureSheet } from '@kitbag/core-design';
import {
  KB_DENOMINATORS,
  KB_MAX_BEATS,
  KB_SUBDIVISION_BOUNDS,
} from '@kitbag/core-native';

import { usePlayAlong } from './playAlongHooks.ts';

export const PATTERN_SHEET = {
  meter: 'meter',
  subdivision: 'subdivision',
} as const;

export type PatternSheet = (typeof PATTERN_SHEET)[keyof typeof PATTERN_SHEET];

export interface PatternSheetsProps {
  readonly open: PatternSheet | null;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function PatternSheets({
  open,
  bottomInset,
  onDismiss,
}: PatternSheetsProps) {
  const { beatsPerBar, denominator, subdivision } = usePlayAlong(
    (s) => s.pattern,
  );
  const setBeats = usePlayAlong((s) => s.setBeats);
  const setSubdivision = usePlayAlong((s) => s.setSubdivision);
  return (
    <>
      <TimeSignatureSheet
        visible={open === PATTERN_SHEET.meter}
        bottomInset={bottomInset}
        beatsPerBar={beatsPerBar}
        denominator={denominator}
        maxBeats={KB_MAX_BEATS}
        denominators={KB_DENOMINATORS}
        onSet={setBeats}
        onDismiss={onDismiss}
      />
      <SubdivisionSheet
        visible={open === PATTERN_SHEET.subdivision}
        bottomInset={bottomInset}
        subdivision={subdivision}
        denominator={denominator}
        bounds={KB_SUBDIVISION_BOUNDS}
        onPick={setSubdivision}
        onDismiss={onDismiss}
      />
    </>
  );
}
