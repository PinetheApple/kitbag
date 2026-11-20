import {
  Button,
  createThemedStyles,
  EmptyState,
  nextFromLabel,
  playerWaveBars,
  QUEUE_TEXT,
  SectionHeader,
  Sheet,
  SheetHint,
  space,
  upNextCountLabel,
} from '@kitbag/core-design';
import {
  entriesAfter,
  isPresetEntry,
  playQueuedNow,
  queuedSongOf,
  useLibrary,
  usePlayOrder,
  useShownSongId,
  useShownStemSetId,
  useStage,
  useUpNextCount,
  type LeftSetlist,
  type QueuedSong,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { clearQueueBody } from '../logic/upNextText.ts';
import { NowPlaying, QueuedRow, SetlistRow } from './QueueRows.tsx';
import {
  leaveForQueued,
  leaveOf,
  useLeaveAfterClose,
  type PlayOrderRoutes,
} from './usePlayOrderNav.ts';

const useStyles = createThemedStyles(() => ({
  list: { gap: space.controlGap },
  footer: { flexDirection: 'row', gap: space.controlGap },
}));

interface QueueListProps {
  readonly onPlay: (song: QueuedSong) => void;
  readonly onOpen: (entry: SetlistEntry) => void;
  readonly onClear: () => void;
  readonly onLeave: () => void;
}

function QueuedSection({
  onPlay,
  onClear,
}: Pick<QueueListProps, 'onPlay' | 'onClear'>) {
  const styles = useStyles();
  const queue = usePlayOrder((s) => s.queue);
  if (queue.length === 0) return null;
  return (
    <>
      <SectionHeader
        label={QUEUE_TEXT.nextInQueue}
        action={
          <Button
            variant="ghost"
            size="target"
            icon="clearQueue"
            iconSize="caret"
            label={QUEUE_TEXT.clearQueue}
            onPress={onClear}
          />
        }
      />
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
  );
}

function SetlistSection({
  onOpen,
  onLeave,
}: Pick<QueueListProps, 'onOpen' | 'onLeave'>) {
  const styles = useStyles();
  const { stage, cursor, name } = useStage();
  if (stage.setlistId === null) return null;
  const later = entriesAfter(stage, cursor);
  return (
    <>
      <SectionHeader
        label={nextFromLabel(name)}
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
      {later.length === 0 ? null : (
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
      )}
    </>
  );
}

function QueueList(props: QueueListProps) {
  const upNextCount = useUpNextCount();
  return (
    <>
      <QueuedSection onPlay={props.onPlay} onClear={props.onClear} />
      <SetlistSection onOpen={props.onOpen} onLeave={props.onLeave} />
      {upNextCount === 0 ? (
        <EmptyState
          icon="queue"
          title={QUEUE_TEXT.nothingQueued}
          reason={QUEUE_TEXT.nothingQueuedReason}
        />
      ) : null}
    </>
  );
}

interface FooterProps {
  readonly canPlay: boolean;
  readonly onDone: () => void;
  readonly onPlayQueue: () => void;
}

function Footer({ canPlay, onDone, onPlayQueue }: FooterProps) {
  const styles = useStyles();
  if (!canPlay)
    return (
      <View style={styles.footer}>
        <Button fill variant="tonal" label={QUEUE_TEXT.done} onPress={onDone} />
      </View>
    );
  return (
    <View style={styles.footer}>
      <Button fill variant="ghost" label={QUEUE_TEXT.done} onPress={onDone} />
      <Button
        fill
        variant="primary"
        icon="play"
        iconSize="sheetButton"
        label={QUEUE_TEXT.playQueue}
        onPress={onPlayQueue}
      />
    </View>
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

export interface QueueSheetProps extends PlayOrderRoutes {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playsInPlace: boolean;
  readonly onDismiss: () => void;
  readonly onLeftSetlist: (left: LeftSetlist) => void;
}

const stemsOf = (stemSetId: number): QueuedSong => ({
  kind: 'stems',
  id: stemSetId,
});

function useQueuePlay(props: QueueSheetProps) {
  const openEntry = usePlayOrder((s) => s.openEntry);
  const playQueued = usePlayOrder((s) => s.playQueued);
  const exit = useLeaveAfterClose(props, props.visible);
  const { onDismiss, playsInPlace } = props;
  const play = useCallback(
    (song: QueuedSong) => {
      const taking = playQueued(song);
      if (playsInPlace)
        void taking.then(() => playQueuedNow(song, playerWaveBars));
      else exit.leaveFor(leaveForQueued(song));
      onDismiss();
    },
    [playQueued, playsInPlace, exit, onDismiss],
  );
  const open = useCallback(
    (entry: SetlistEntry) => {
      const opening = openEntry(entry);
      if (playsInPlace && !isPresetEntry(entry))
        void opening.then(() =>
          playQueuedNow(stemsOf(entry.stemSetId), playerWaveBars),
        );
      else exit.leaveFor(leaveOf(entry));
      onDismiss();
    },
    [openEntry, playsInPlace, exit, onDismiss],
  );
  return { play, open, closed: exit.closed };
}

function useQueueRowActions(props: QueueSheetProps) {
  const queue = usePlayOrder((s) => s.queue);
  const leaveSetlist = useLibrary((s) => s.leaveSetlist);
  const { play, open, closed } = useQueuePlay(props);
  const { onLeftSetlist } = props;
  const leave = useCallback(() => {
    void leaveSetlist().then((left) => {
      if (left !== null) onLeftSetlist(left);
    });
  }, [leaveSetlist, onLeftSetlist]);
  const [first] = queue;
  const playQueue = useCallback(() => {
    if (first !== undefined) play(queuedSongOf(first));
  }, [first, play]);
  return { play, open, leave, closed, playQueue, queued: first !== undefined };
}

function useNothingPlaying(): boolean {
  const songId = useShownSongId();
  const setId = useShownStemSetId();
  return songId === null && setId === null;
}

export function QueueSheet(props: QueueSheetProps) {
  const { visible, bottomInset, onDismiss } = props;
  const [confirming, setConfirming] = useState(false);
  const upNextCount = useUpNextCount();
  const idle = useNothingPlaying();
  const actions = useQueueRowActions(props);
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
        title={QUEUE_TEXT.queue}
        titleDetail={
          upNextCount === 0 ? undefined : upNextCountLabel(upNextCount)
        }
        dismissLabel={QUEUE_TEXT.closeQueue}
        bottomInset={bottomInset}
        onDismiss={dismiss}
        onClosed={actions.closed}
      >
        <NowPlaying />
        <QueueList
          onPlay={actions.play}
          onOpen={actions.open}
          onClear={askClear}
          onLeave={actions.leave}
        />
        <Footer
          canPlay={idle && actions.queued}
          onDone={dismiss}
          onPlayQueue={actions.playQueue}
        />
      </Sheet>
      <ClearQueueSheet
        visible={shown === 'confirm'}
        bottomInset={bottomInset}
        onCancel={backToList}
      />
    </>
  );
}
