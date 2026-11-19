import {
  Button,
  createThemedStyles,
  EditDivider,
  EditRow,
  EditValue,
  Sheet,
  space,
} from '@kitbag/core-design';
import {
  formatClockSeconds,
  useStemPlayer,
  type ExportSummary,
} from '@kitbag/core-state';
import { Fragment, useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  formatLabel,
  keyLabel,
  rangeLabel,
  sizeLabel,
  speedLabel,
  stemsLabel,
} from '../logic/exportView.ts';

const HINT =
  'Renders the whole song as you hear it now into one file, then opens the share sheet. You can keep playing while it runs.';
const UNREAD = '…';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

function summaryRows(summary: ExportSummary | null) {
  const value = (text: (s: ExportSummary) => string) =>
    summary === null ? UNREAD : text(summary);
  return [
    ['Speed', value((s) => speedLabel(s.speed))],
    ['Key', value((s) => keyLabel(s.key))],
    ['Stems', value(stemsLabel)],
    ['Range', value((s) => rangeLabel(s.loopSet))],
    ['Length', value((s) => formatClockSeconds(s.lengthSec))],
    ['Metronome', 'Click not included'],
    ['Format', value((s) => formatLabel(s.sampleRate))],
    ['Estimated size', value((s) => sizeLabel(s.bytes))],
  ] as const;
}

interface ExportSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function ExportSheet({
  visible,
  bottomInset,
  onClose,
}: ExportSheetProps) {
  const styles = useStyles();
  const readExportSummary = useStemPlayer((s) => s.readExportSummary);
  const startExport = useStemPlayer((s) => s.startExport);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const reads = useRef(0);
  const handleShow = useCallback(() => {
    const read = ++reads.current;
    setSummary(null);
    readExportSummary().then(
      (next) => {
        if (read === reads.current) setSummary(next);
      },
      (error: unknown) => {
        console.warn('[kitbag] export summary not read', error);
      },
    );
  }, [readExportSummary]);
  const handleExport = useCallback(() => {
    onClose();
    void startExport();
  }, [onClose, startExport]);
  return (
    <Sheet
      visible={visible}
      title="Export mix"
      titleIcon="exportMix"
      titleSize="large"
      hint={HINT}
      dismissLabel="Close without exporting"
      bottomInset={bottomInset}
      onShow={handleShow}
      onDismiss={onClose}
    >
      <View>
        {summaryRows(summary).map(([label, value], index) => (
          <Fragment key={label}>
            {index === 0 ? null : <EditDivider />}
            <EditRow label={label}>
              <EditValue>{value}</EditValue>
            </EditRow>
          </Fragment>
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          variant="ghost"
          size="sheet"
          fill
          label="Cancel"
          onPress={onClose}
        />
        <Button
          variant="primary"
          size="sheet"
          fill
          icon="exportMix"
          label="Export"
          accessibilityLabel="Export the mix"
          onPress={handleExport}
        />
      </View>
    </Sheet>
  );
}
