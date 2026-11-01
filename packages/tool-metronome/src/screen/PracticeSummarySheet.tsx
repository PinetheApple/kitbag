import {
  Button,
  createThemedStyles,
  EditDivider,
  EditRow,
  EditValue,
  Sheet,
  SheetHint,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import {
  getPracticeSessionStore,
  type PracticeSummary,
} from '@kitbag/core-state';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import {
  averageTempoLabel,
  longestStretchLabel,
  practiceContextLine,
} from '../logic/practiceSummary.ts';
import { formatPracticeElapsed } from '../logic/practiceTimer.ts';

type SaveState = 'idle' | 'saving' | 'failed';

interface SaveAttempt {
  readonly uuid: string;
  readonly state: Exclude<SaveState, 'idle'>;
}

const useStyles = createThemedStyles((theme) => ({
  duration: {
    ...textStyle(textRoles.sheetNumeral),
    color: theme.color.text,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));

function subscribePending(onChange: () => void): () => void {
  return getPracticeSessionStore().subscribe(onChange);
}

function oldestPendingPractice(): PracticeSummary | null {
  return getPracticeSessionStore().getState().pending[0] ?? null;
}

export function usePendingPractice(): PracticeSummary | null {
  return useSyncExternalStore(subscribePending, oldestPendingPractice);
}

interface PracticeSummarySheetProps {
  readonly visible: boolean;
  readonly summary: PracticeSummary | null;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function PracticeSummarySheet({
  visible,
  summary,
  bottomInset,
  onDismiss,
}: PracticeSummarySheetProps) {
  const styles = useStyles();
  const [attempt, setAttempt] = useState<SaveAttempt | null>(null);
  const uuid = summary?.uuid ?? null;
  const save: SaveState = attempt?.uuid === uuid ? attempt.state : 'idle';

  const handleShow = useCallback(() => {
    setAttempt(null);
  }, []);

  const handleSave = useCallback(() => {
    if (uuid === null) return;
    setAttempt({ uuid, state: 'saving' });
    getPracticeSessionStore()
      .getState()
      .saveSession()
      .then(
        () => {
          setAttempt(null);
        },
        () => {
          setAttempt({ uuid, state: 'failed' });
        },
      );
  }, [uuid]);

  const handleDiscard = useCallback(() => {
    getPracticeSessionStore().getState().discardSession();
  }, []);

  const context = summary === null ? null : practiceContextLine(summary);
  const longest =
    summary === null ? null : longestStretchLabel(summary.longestStretch);
  const duration =
    summary === null ? '' : formatPracticeElapsed(summary.playedMs);

  return (
    <Sheet
      visible={visible && summary !== null}
      title="Practice summary"
      titleIcon="practice"
      dismissLabel="Close the practice summary"
      bottomInset={bottomInset}
      dim
      onShow={handleShow}
      onDismiss={onDismiss}
    >
      {summary === null ? null : (
        <>
          <View>
            <Text
              style={styles.duration}
              accessibilityLabel={`Practised ${duration}`}
            >
              {duration}
            </Text>
            {context === null ? null : (
              <SheetHint centered>{context}</SheetHint>
            )}
          </View>
          <View>
            <EditRow label="Average tempo">
              <EditValue>{averageTempoLabel(summary.avgBpm)}</EditValue>
            </EditRow>
            <EditDivider />
            {longest === null ? null : (
              <>
                <EditRow label="Longest stretch">
                  <EditValue>{longest}</EditValue>
                </EditRow>
                <EditDivider />
              </>
            )}
          </View>
          {save === 'failed' ? (
            <View accessibilityLiveRegion="polite">
              <SheetHint>
                This session could not be saved. Try again, or discard it.
              </SheetHint>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button
              fill
              variant="ghost"
              size="sheet"
              label="Discard"
              accessibilityLabel="Discard this practice session"
              onPress={handleDiscard}
            />
            <Button
              fill
              variant="primary"
              size="sheet"
              label={save === 'failed' ? 'Try again' : 'Save session'}
              disabled={save === 'saving'}
              onPress={handleSave}
            />
          </View>
        </>
      )}
    </Sheet>
  );
}
