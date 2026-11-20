import {
  Badge,
  createThemedStyles,
  DragListRow,
  type DragHandleLook,
  FACT_SEPARATOR,
  Icon,
  minTouchTargetDp,
  PlainListRow,
  PLAYING,
  QUEUE_TEXT,
  queueSheet,
  queuedRowLabel,
  removeFromQueueLabel,
  setlistPlaceParts,
  RowText,
  SectionHeader,
  usePlainRowStyles,
} from '@kitbag/core-design';
import {
  entryName,
  isPresetEntry,
  queuedSongFacts,
  queuedSongOf,
  queuedSongTitle,
  STEMS_BADGE,
  stemFacts,
  useLibrary,
  useLibrarySongs,
  usePlayOrder,
  useSetlistSpot,
  useShownSongId,
  useShownStemSetId,
  useSongPlayer,
  useStemPlayer,
  useStemSongs,
  type PlayOrderStore,
  type QueuedSong,
  type SetlistEntry,
  type SetlistSpot,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { setlistRowSubtitle } from '../logic/upNextText.ts';

type PlayQueueEntry = PlayOrderStore['queue'][number];

const NOW_BADGE = 'NOW';
const QUEUE_HANDLE: DragHandleLook = { size: 'queueHandle', color: 'text3' };

const useStyles = createThemedStyles(() => ({
  trailing: { flexDirection: 'row', alignItems: 'center' },
  badges: { gap: queueSheet.badgeGap },
  badgeSlot: { alignSelf: 'flex-end' },
  iconTarget: {
    width: minTouchTargetDp,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

function StemsBadge() {
  return <Badge label={STEMS_BADGE} />;
}

function nowPlayingSubtitle(facts: string, spot: SetlistSpot | null): string {
  const where = spot === null ? [facts] : setlistPlaceParts(spot);
  return [PLAYING, ...where].filter((part) => part !== '').join(FACT_SEPARATOR);
}

interface NowPlayingRowProps {
  readonly title: string;
  readonly subtitle: string;
  readonly stems: boolean;
}

function NowPlayingRow({ title, subtitle, stems }: NowPlayingRowProps) {
  const styles = useStyles();
  const row = usePlainRowStyles();
  return (
    <View
      accessible
      accessibilityLabel={`${QUEUE_TEXT.nowPlaying}: ${title}`}
      style={[row.row, row.active]}
    >
      <View style={row.press}>
        <RowText title={title} subtitle={subtitle} />
        <View style={styles.badges}>
          {stems ? (
            <View style={styles.badgeSlot}>
              <StemsBadge />
            </View>
          ) : null}
          <View style={styles.badgeSlot}>
            <Badge tone="accent" variant="filled" label={NOW_BADGE} />
          </View>
        </View>
      </View>
    </View>
  );
}

function StemNowPlaying({ setId }: { readonly setId: number }) {
  const title = useStemPlayer((s) => s.title);
  const stems = useStemSongs();
  const spot = useSetlistSpot(setId);
  return (
    <NowPlayingRow
      title={title}
      subtitle={nowPlayingSubtitle(stemFacts(setId, stems), spot)}
      stems
    />
  );
}

function SongNowPlaying({ songId }: { readonly songId: number }) {
  const title = useSongPlayer((s) => s.title);
  const library = useLibrarySongs();
  const facts = queuedSongFacts({ kind: 'song', id: songId }, library);
  return (
    <NowPlayingRow
      title={title}
      subtitle={nowPlayingSubtitle(facts, null)}
      stems={false}
    />
  );
}

function nowPlayingRow(songId: number | null, setId: number | null) {
  if (songId !== null) return <SongNowPlaying songId={songId} />;
  return setId === null ? null : <StemNowPlaying setId={setId} />;
}

export function NowPlaying() {
  const row = nowPlayingRow(useShownSongId(), useShownStemSetId());
  if (row === null) return null;
  return (
    <>
      <SectionHeader label={QUEUE_TEXT.nowPlaying} />
      {row}
    </>
  );
}

interface RemoveKeyProps {
  readonly label: string;
  readonly onPress: () => void;
}

function RemoveKey({ label, onPress }: RemoveKeyProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconTarget}
      onPress={onPress}
    >
      <Icon name="close" size="transportSmall" color="text2" />
    </Pressable>
  );
}

interface QueuedRowProps {
  readonly entry: PlayQueueEntry;
  readonly index: number;
  readonly count: number;
  readonly onPlay: (song: QueuedSong) => void;
}

export function QueuedRow({ entry, index, count, onPlay }: QueuedRowProps) {
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
  const swipe = useMemo(
    () => ({
      label: QUEUE_TEXT.remove,
      onRemove: () => removeQueued(song).then(() => true),
    }),
    [removeQueued, song],
  );
  return (
    <DragListRow
      title={title}
      subtitle={queuedSongFacts(song, library)}
      reorder={reorder}
      swipe={swipe}
      handle={QUEUE_HANDLE}
      trailing={
        <View style={styles.trailing}>
          {song.kind === 'stems' ? <StemsBadge /> : null}
          <RemoveKey label={removeFromQueueLabel(title)} onPress={remove} />
        </View>
      }
      accessibilityLabel={queuedRowLabel(index + 1, title)}
      onPress={play}
    />
  );
}

interface SetlistRowProps {
  readonly entry: SetlistEntry;
  readonly setlistName: string;
  readonly onOpen: (entry: SetlistEntry) => void;
}

export function SetlistRow({ entry, setlistName, onOpen }: SetlistRowProps) {
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
          <RemoveKey label={`Skip ${title} this time`} onPress={skip} />
        </View>
      }
      accessibilityLabel={`${title}, from ${setlistName}`}
      onPress={open}
    />
  );
}
