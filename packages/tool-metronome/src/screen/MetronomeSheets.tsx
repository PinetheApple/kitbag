import { BPM_BOUNDS, type PracticeSummary } from '@kitbag/core-state';

import { MeterSheet } from './MeterSheet.tsx';
import { NumberEntrySheet } from './NumberEntrySheet.tsx';
import { PracticeSheet } from './PracticeSheet.tsx';
import { PracticeSummarySheet } from './PracticeSummarySheet.tsx';
import { SubdivisionSheet } from './SubdivisionSheet.tsx';

export type OpenSheet =
  'none' | 'numpad' | 'meter' | 'subdivision' | 'practice' | 'summary';

interface MetronomeSheetsProps {
  readonly openSheet: OpenSheet;
  readonly bpm: number;
  readonly bottomInset: number;
  readonly pendingPractice: PracticeSummary | null;
  readonly onTypedTempo: (bpm: number) => void;
  readonly onClose: () => void;
}

export function MetronomeSheets({
  openSheet,
  bpm,
  bottomInset,
  pendingPractice,
  onTypedTempo,
  onClose,
}: MetronomeSheetsProps) {
  return (
    <>
      <NumberEntrySheet
        visible={openSheet === 'numpad'}
        title="Tempo"
        confirmLabel="Set tempo"
        value={bpm}
        bounds={BPM_BOUNDS}
        unit="BPM"
        bottomInset={bottomInset}
        onConfirm={onTypedTempo}
        onDismiss={onClose}
      />
      <MeterSheet
        visible={openSheet === 'meter'}
        bottomInset={bottomInset}
        onDismiss={onClose}
      />
      <SubdivisionSheet
        visible={openSheet === 'subdivision'}
        bottomInset={bottomInset}
        onDismiss={onClose}
      />
      <PracticeSheet
        visible={openSheet === 'practice'}
        bottomInset={bottomInset}
        onDismiss={onClose}
      />
      <PracticeSummarySheet
        visible={openSheet === 'summary'}
        summary={pendingPractice}
        bottomInset={bottomInset}
      />
    </>
  );
}
