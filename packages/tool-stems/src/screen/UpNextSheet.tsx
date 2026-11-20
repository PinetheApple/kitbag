import {
  Badge,
  Button,
  createThemedStyles,
  DragListRow,
  EmptyState,
  FACT_SEPARATOR,
  Icon,
  minTouchTargetDp,
  PlainListRow,
  PLAYING,
  QUEUE_TEXT,
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
  queuedSongFacts,
  queuedSongOf,
  queuedSongTitle,
  STEMS_BADGE,
  stemFacts,
  useLibrarySongs,
  usePlayOrder,
  useStage,
  useStemPlayer,
  useLibrary,
  useStemSongs,
  type LeftSetlist,
  type PlayOrderStore,
  type QueuedSong,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { clearQueueBody, setlistRowSubtitle } from '../logic/upNextText.ts';
import { UP_NEXT } from './UpNextRow.tsx';
import {
  useLeaveAfterClose,
  leaveForQueued,
  leaveOf,
  usePlayOrderNav,
  type PlayOrderRoutes,
} from './usePlayOrderNav.ts';

type PlayQueueEntry = PlayOrderStore['queue'][number];

const useStyles = createThemedStyles(() => ({
  list: { gap: space.controlGap },
  trailing: { flexDirection: 'row', alignItems: 'center' },
  iconTarget: {
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
  const subtitle = [PLAYING, facts]
    .filter((part) => part !== '')
    .join(FACT_SEPARATOR);
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
  readonly onPlay: (song: QueuedSong) => void;
}

function QueuedRow({ entry, index, count, onPlay }: QueuedRowProps) {
  const styles = useStyles();
  const library = useLibrarySongs();
  const moveQueued = usePlayOrder((s) => s.moveQueued);
  const removeQueued = usePlayOrder((s) => s.removeQueued);
  const song = useMemo(() => queuedSongOf(entry), [entry]);
  const title = queuedSongTitle(song, library);
  const onMove = useCallback(
    (_from: number, to: number) => {
      void moveQueued(song, to);
    },
    [moveQueued, song],
  );
  const reorder = useMemo(
    () => ({ index, count, onMove }),
    [index, count, onMove],
  );
  const play = useCallback(() => {
    onPlay(song);
  }, [onPlay, song]);
  const remove = useCallback(() => {
    void removeQueued(song);
  }, [removeQueued, song]);
  return (
    <DragListRow
      title={title}
      subtitle={queuedSongFacts(song, library)}
      reorder={reorder}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title} from Up next`}
          style={styles.iconTarget}
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
  const skipSetlistEntry = useLibrary((s) => s.skipSetlistEntry);
  const open = useCallback(() => {
    onOpen(entry);
  }, [onOpen, entry]);
  const skip = useCallback(() => {
    skipSetlistEntry(entry.item.id);
  }, [skipSetlistEntry, entry]);
  const title = entryName(entry, stems);
  return (
    <PlainListRow
      title={title}
      subtitle={setlistRowSubtitle(entry, setlistName, stems)}
      trailing={
        <View style={styles.trailing}>
          {isPresetEntry(entry) ? null : <StemsBadge />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Skip ${title} this time`}
            style={styles.iconTarget}
            onPress={skip}
          >
            <Icon name="close" size="transportSmall" color="text2" />
          </Pressable>
        </View>
      }
      accessibilityLabel={`${title}, from ${setlistName}`}
      onPress={open}
    />
  );
}

interface UpNextListProps {
  readonly onPlay: (song: QueuedSong) => void;
  readonly onOpen: (entry: SetlistEntry) => void;
  readonly onDone: () => void;
  readonly onLeave: () => void;
}

function UpNextList({ onPlay, onOpen, onDone, onLeave }: UpNextListProps) {
  const styles = useStyles();
  const queue = usePlayOrder((s) => s.queue);
  const { stage, cursor, name } = useStage();
  const later = entriesAfter(stage, cursor);
  const setlistHeader =
    stage.setlistId === null ? null : (
      <SectionHeader
        label={`Then from ${name}`}
        action={
          <Button
            variant="ghost"
            size="target"
            icon="close"
            iconSize="caret"
            label={QUEUE_TEXT.leaveSetlist}
            onPress={onLeave}
          />
        }
      />
    );
  if (queue.length === 0 && later.length === 0)
    return (
      <>
        {setlistHeader}
        <EmptyState
          icon="playNext"
          title="Nothing queued"
          reason="Use Play next or Add to queue on a song. When this song ends, playback stops."
          actionLabel="Done"
          onAction={onDone}
        />
      </>
    );
  return (
    <>
      {queue.length === 0 ? null : (
        <>
          <SectionHeader label="Queued" />
          <View style={styles.list}>
            {queue.map((entry, index) => (
              <QueuedRow
                key={entry.id}
                entry={entry}
                index={index}
                count={queue.length}
                onPlay={onPlay}
              />
            ))}
          </View>
        </>
      )}
      {setlistHeader}
      {later.length === 0 ? null : (
        <>
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
  readonly onLeftSetlist: (left: LeftSetlist) => void;
}

function useUpNextSheet(props: UpNextSheetProps) {
  const nav = usePlayOrderNav(props);
  const playQueued = usePlayOrder((s) => s.playQueued);
  const exit = useLeaveAfterClose(props, props.visible);
  const leaveSetlist = useLibrary((s) => s.leaveSetlist);
  const { onDismiss, onLeftSetlist } = props;
  const leave = useCallback(() => {
    void leaveSetlist().then((left) => {
      if (left !== null) onLeftSetlist(left);
    });
  }, [leaveSetlist, onLeftSetlist]);
  const play = useCallback(
    (song: QueuedSong) => {
      exit.leaveFor(leaveForQueued(song));
      void playQueued(song);
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
  return { play, open, leave, closed: exit.closed };
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
        <UpNextList
          onPlay={sheet.play}
          onOpen={sheet.open}
          onDone={dismiss}
          onLeave={sheet.leave}
        />
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
