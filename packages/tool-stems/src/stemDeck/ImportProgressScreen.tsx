import { AppBar, Button } from '@kitbag/core-design';
import {
  useStemDeck,
  type StemDeckFailure,
  type StemDeckImportView,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ImportRowView } from './ImportRowView.tsx';
import {
  addedText,
  finishedText,
  importClearable,
  retryLabel,
  stopNotice,
} from './logic/progressText.ts';
import { NoticeCard } from './NoticeCard.tsx';
import {
  useInset,
  useStemDeckStyles,
  type StemDeckInsets,
} from './stemDeckStyles.ts';

const LEAVE_HINT =
  'You can leave Kitbag. Songs keep coming in, and the notification shows how far along they are.';
const CLOSE = 'Close';
const CLEAR = 'Clear';
const CLEAR_LABEL = 'Clear the unfinished import';
const EMPTY_VIEW: StemDeckImportView = {
  origin: null,
  rows: [],
  added: 0,
  running: false,
  finished: false,
  stopped: null,
  retryCount: 0,
};

export interface ImportProgressScreenProps {
  readonly insets: StemDeckInsets;
  readonly onBack: () => void;
  readonly onOpenStemSongs: () => void;
}

function Status({
  view,
  failure,
}: {
  readonly view: StemDeckImportView;
  readonly failure: StemDeckFailure | null;
}) {
  const styles = useStemDeckStyles();
  if (failure !== null) return <NoticeCard {...stopNotice(view, failure)} />;
  if (view.running) return <Text style={styles.hint}>{LEAVE_HINT}</Text>;
  if (view.finished)
    return (
      <NoticeCard
        tone="success"
        title="All done"
        body={finishedText(view.added)}
      />
    );
  return null;
}

function useStems() {
  const catalog = useStemDeck((s) => s.catalog);
  return useCallback(
    (jobId: string) =>
      catalog?.songs.find((s) => s.jobId === jobId)?.lanes.length ?? null,
    [catalog],
  );
}

function useClear(onCleared: () => void) {
  const clearImport = useStemDeck((s) => s.clearImport);
  return useCallback(() => {
    void clearImport().then((cleared) => {
      if (cleared) onCleared();
    });
  }, [clearImport, onCleared]);
}

function StoppedActions({
  view,
  onBack,
}: {
  readonly view: StemDeckImportView;
  readonly onBack: () => void;
}) {
  const styles = useStemDeckStyles();
  const retryImport = useStemDeck((s) => s.retryImport);
  const retry = useCallback(() => {
    void retryImport();
  }, [retryImport]);
  const clear = useClear(onBack);
  return (
    <>
      <View style={styles.actions}>
        <Button
          fill
          variant="ghost"
          size="target"
          label={CLOSE}
          onPress={onBack}
        />
        {view.retryCount === 0 ? null : (
          <Button
            fill
            variant="primary"
            size="target"
            icon="reset"
            label={retryLabel(view.retryCount)}
            onPress={retry}
          />
        )}
      </View>
      {importClearable(view) ? (
        <Button
          variant="ghost"
          size="target"
          label={CLEAR}
          accessibilityLabel={CLEAR_LABEL}
          onPress={clear}
        />
      ) : null}
    </>
  );
}

interface DockProps {
  readonly view: StemDeckImportView;
  readonly bottomInset: number;
  readonly onBack: () => void;
  readonly onOpenStemSongs: () => void;
}

function Dock({ view, bottomInset, onBack, onOpenStemSongs }: DockProps) {
  const styles = useStemDeckStyles();
  const cancelImport = useStemDeck((s) => s.cancelImport);
  const dock = useInset(styles.dock, 'paddingBottom', bottomInset);
  if (view.running)
    return (
      <View style={dock}>
        <Button
          variant="tonal"
          size="target"
          label="Stop importing"
          onPress={cancelImport}
        />
      </View>
    );
  if (view.finished)
    return (
      <View style={dock}>
        <Button
          variant="primary"
          size="target"
          label="Open Stem songs"
          onPress={onOpenStemSongs}
        />
      </View>
    );
  return (
    <View style={dock}>
      <StoppedActions view={view} onBack={onBack} />
    </View>
  );
}

export function ImportProgressScreen({
  insets,
  onBack,
  onOpenStemSongs,
}: ImportProgressScreenProps) {
  const styles = useStemDeckStyles();
  const view = useStemDeck((s) => s.importView) ?? EMPTY_VIEW;
  const importFailure = useStemDeck((s) => s.importFailure);
  const stemsOf = useStems();
  const failure = importFailure ?? view.stopped;
  const frame = useInset(styles.screen, 'paddingTop', insets.top);
  return (
    <View style={frame}>
      <AppBar
        flush
        title="Importing from StemDeck"
        subtitle={view.rows.length === 0 ? undefined : addedText(view)}
        onBack={onBack}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Status view={view} failure={failure} />
        <View style={styles.list}>
          {view.rows.map((row) => (
            <ImportRowView
              key={row.jobId}
              row={row}
              stems={stemsOf(row.jobId)}
            />
          ))}
        </View>
      </ScrollView>
      <Dock
        view={view}
        bottomInset={insets.bottom}
        onBack={onBack}
        onOpenStemSongs={onOpenStemSongs}
      />
    </View>
  );
}
