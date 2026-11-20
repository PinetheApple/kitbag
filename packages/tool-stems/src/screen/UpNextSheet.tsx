import {
  Badge,
  Button,
  createThemedStyles,
  DragListRow,
  EmptyState,
  Icon,
  minTouchTargetDp,
  opacity,
  PlainListRow,
  RowText,
  usePlainRowStyles,
  SectionHeader,
  Sheet,
  SheetHint,
  space,
} from '@kitbag/core-design';
import {
  entriesAfter,
  entryName,
  isPresetEntry,
  STEMS_BADGE,
  stemFacts,
  stemSongTitle,
  usePlayOrder,
  useStage,
  useStemPlayer,
  useStemSongs,
  type PlayOrderStore,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SEPARATOR } from '../stemDeck/logic/songFacts.ts';
import { clearQueueBody, setlistRowSubtitle } from '../logic/upNextText.ts';
import { UP_NEXT } from './UpNextRow.tsx';
import {
  useLeaveAfterClose,
  leaveOf,
  usePlayOrderNav,
  type PlayOrderRoutes,
} from './usePlayOrderNav.ts';

type PlayQueueEntry = PlayOrderStore['queue'][number];

const useStyles = createThemedStyles(() => ({
  list: { gap: space.controlGap },
  upcoming: { opacity: opacity.upcoming },
  remove: {
    width: minTouchTargetDp,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: space.controlGap },
}));

function StemsBadge() {
  return <Badge label={STEMS_BADGE} />;
}

function NowPlaying() {
  const row = usePlainRowStyles();
  const title = useStemPlayer((s) => s.title);
  const setId = useStemPlayer((s) => s.setId);
  const stems = useStemSongs();
  const facts = setId === null ? '' : stemFacts(setId, stems);
  const subtitle = ['Playing', facts]
    .filter((part) => part !== '')
    .join(SEPARATOR);
  return (
    <View
      accessible
      accessibilityLabel={`Now playing: ${title}`}
      style={[row.row, row.active]}
    >
      <View style={row.press}>
        <RowText title={title} subtitle={subtitle} />
        <View>
          <StemsBadge />
          <Badge tone="accent" variant="filled" label="NOW" />
        </View>
      </View>
    </View>
  );
}

interface QueuedRowProps {
  readonly entry: PlayQueueEntry;
  readonly index: number;
  readonly count: number;
  readonly onPlay: (stemSetId: number) => void;
}

function QueuedRow({ entry, index, count, onPlay }: QueuedRowProps) {
  const styles = useStyles();
  const stems = useStemSongs();
  const moveQueued = usePlayOrder((s) => s.moveQueued);
  const removeQueued = usePlayOrder((s) => s.removeQueued);
  const { stemSetId } = entry;
  const title = stemSongTitle(stemSetId, stems);
  const onMove = useCallback(
    (_from: number, to: number) => {
      void moveQueued(stemSetId, to);
    },
    [moveQueued, stemSetId],
  );
  const reorder = useMemo(
    () => ({ index, count, onMove }),
    [index, count, onMove],
  );
  const play = useCallback(() => {
    onPlay(stemSetId);
  }, [onPlay, stemSetId]);
  const remove = useCallback(() => {
    void removeQueued(stemSetId);
  }, [removeQueued, stemSetId]);
  return (
    <DragListRow
      title={title}
      subtitle={stemFacts(stemSetId, stems)}
      reorder={reorder}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title} from Up next`}
          style={styles.remove}
          onPress={remove}
        >
          <Icon name="close" size="transportSmall" color="text2" />
        </Pressable>
      }
      accessibilityLabel={`${String(index + 1)}. ${title}, queued. Plays it now`}
      onPress={play}
    />
  );
}

interface SetlistRowProps {
  readonly entry: SetlistEntry;
  readonly setlistName: string;
  readonly onOpen: (entry: SetlistEntry) => void;
}

function SetlistRow({ entry, setlistName, onOpen }: SetlistRowProps) {
  const styles = useStyles();
  const stems = useStemSongs();
  const open = useCallback(() => {
    onOpen(entry);
  }, [onOpen, entry]);
  const title = entryName(entry, stems);
  return (
    <View style={styles.upcoming}>
      <PlainListRow
        title={title}
        subtitle={setlistRowSubtitle(entry, setlistName, stems)}
        trailing={isPresetEntry(entry) ? undefined : <StemsBadge />}
        accessibilityLabel={`${title}, from ${setlistName}`}
        onPress={open}
      />
    </View>
  );
}

interface UpNextListProps {
  readonly onPlay: (stemSetId: number) => void;
  readonly onOpen: (entry: SetlistEntry) => void;
  readonly onDone: () => void;
}

function UpNextList({ onPlay, onOpen, onDone }: UpNextListProps) {
  const styles = useStyles();
  const queue = usePlayOrder((s) => s.queue);
  const { stage, cursor, name } = useStage();
  const later = entriesAfter(stage, cursor);
  if (queue.length === 0 && later.length === 0)
    return (
      <EmptyState
        icon="playNext"
        title="Nothing queued"
        reason="Use Play next on a stem song to queue it here. When this song ends, playback stops."
        actionLabel="Done"
        onAction={onDone}
      />
    );
  return (
    <>
      {queue.length === 0 ? null : (
        <>
          <SectionHeader label="Queued" />
          <View style={styles.list}>
            {queue.map((entry, index) => (
              <QueuedRow
                key={entry.stemSetId}
                entry={entry}
                index={index}
                count={queue.length}
                onPlay={onPlay}
              />
            ))}
          </View>
        </>
      )}
      {later.length === 0 ? null : (
        <>
          <SectionHeader label={`Then from ${name}`} />
          <View style={styles.list}>
            {later.map((entry) => (
              <SetlistRow
                key={entry.item.id}
                entry={entry}
                setlistName={name}
                onOpen={onOpen}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
}

interface ClearQueueSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onCancel: () => void;
}

function ClearQueueSheet({
  visible,
  bottomInset,
  onCancel,
}: ClearQueueSheetProps) {
  const styles = useStyles();
  const queueLength = usePlayOrder((s) => s.queue.length);
  const clearQueue = usePlayOrder((s) => s.clearQueue);
  const { name } = useStage();
  const clear = useCallback(() => {
    void clearQueue().finally(onCancel);
  }, [clearQueue, onCancel]);
  return (
    <Sheet
      visible={visible}
      title="Clear the queue?"
      dismissLabel="Keep the queue"
      bottomInset={bottomInset}
      onDismiss={onCancel}
    >
      <SheetHint>{clearQueueBody(queueLength, name)}</SheetHint>
      <View style={styles.footer}>
        <Button fill variant="ghost" label="Cancel" onPress={onCancel} />
        <Button fill variant="destructive" label="Clear" onPress={clear} />
      </View>
    </Sheet>
  );
}

type Shown = 'list' | 'confirm' | null;

export interface UpNextSheetProps extends PlayOrderRoutes {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

function useUpNextSheet(props: UpNextSheetProps) {
  const nav = usePlayOrderNav(props);
  const playQueued = usePlayOrder((s) => s.playQueued);
  const exit = useLeaveAfterClose(props, props.visible);
  const { onDismiss } = props;
  const play = useCallback(
    (stemSetId: number) => {
      exit.leaveFor({ kind: 'stem', stemSetId });
      void playQueued(stemSetId);
      onDismiss();
    },
    [playQueued, exit, onDismiss],
  );
  const open = useCallback(
    (entry: SetlistEntry) => {
      exit.leaveFor(leaveOf(entry));
      void nav.openEntry(entry);
      onDismiss();
    },
    [nav, exit, onDismiss],
  );
  return { play, open, closed: exit.closed };
}

export function UpNextSheet(props: UpNextSheetProps) {
  const styles = useStyles();
  const { visible, bottomInset, onDismiss } = props;
  const [confirming, setConfirming] = useState(false);
  const queued = usePlayOrder((s) => s.queue.length > 0);
  const { stage, cursor } = useStage();
  const empty = !queued && entriesAfter(stage, cursor).length === 0;
  const sheet = useUpNextSheet(props);
  const shown: Shown = !visible ? null : confirming ? 'confirm' : 'list';
  const askClear = useCallback(() => {
    setConfirming(true);
  }, []);
  const backToList = useCallback(() => {
    setConfirming(false);
  }, []);
  const dismiss = useCallback(() => {
    setConfirming(false);
    onDismiss();
  }, [onDismiss]);
  return (
    <>
      <Sheet
        visible={shown === 'list'}
        title={UP_NEXT}
        dismissLabel="Close Up next"
        bottomInset={bottomInset}
        onDismiss={dismiss}
        onClosed={sheet.closed}
      >
        <SectionHeader label="Now playing" />
        <NowPlaying />
        <UpNextList onPlay={sheet.play} onOpen={sheet.open} onDone={dismiss} />
        {empty ? null : (
          <View style={styles.footer}>
            {queued ? (
              <Button
                fill
                variant="ghost"
                icon="clearQueue"
                label="Clear queue"
                onPress={askClear}
              />
            ) : null}
            <Button fill variant="tonal" label="Done" onPress={dismiss} />
          </View>
        )}
      </Sheet>
      <ClearQueueSheet
        visible={shown === 'confirm'}
        bottomInset={bottomInset}
        onCancel={backToList}
      />
    </>
  );
}
