import {
  Button,
  createThemedStyles,
  EllipsizedText,
  EmptyState,
  Icon,
  libraryList,
  lineRatio,
  SegmentedControl,
  Sheet,
  SheetHint,
  size,
  space,
  textRoles,
  textStyle,
  useAfterSheetClosed,
  useTheme,
  type SegmentOption,
} from '@kitbag/core-design';
import {
  stemSongListFacts,
  useLibrary,
  useStemSongs,
  type LibraryStemSetRow,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionStack, guarded, type SheetAction } from './sheets.tsx';

const METRONOME = 'metronome';
const STEMS = 'stems';
type Kind = typeof METRONOME | typeof STEMS;

const KIND_OPTIONS: readonly SegmentOption<Kind>[] = [
  { value: METRONOME, label: 'Metronome songs' },
  { value: STEMS, label: 'Stem songs' },
];

export const STEM_ADD_HINT =
  'Tap to add at the end. A song can be added more than once.';

const useStyles = createThemedStyles((theme) => ({
  row: {
    minHeight: libraryList.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  tile: {
    width: libraryList.tile,
    height: libraryList.tile,
    borderRadius: libraryList.tileRadius,
    backgroundColor: theme.stemTileFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    ...textStyle(textRoles.listTitle),
    lineHeight: textRoles.listTitle.size * lineRatio.title,
    color: theme.color.text,
  },
  facts: {
    ...textStyle(textRoles.listFacts),
    lineHeight: textRoles.listFacts.size * lineRatio.compactBody,
    color: theme.color.text2,
  },
  body: { gap: space.sectionGap },
}));

interface StemPickRowProps {
  readonly song: LibraryStemSetRow;
  readonly added: boolean;
  readonly onAdd: (song: LibraryStemSetRow) => void;
}

function StemPickRow({ song, added, onAdd }: StemPickRowProps) {
  const styles = useStyles();
  const ink = useTheme().accentInk;
  const press = useCallback(() => {
    onAdd(song);
  }, [onAdd, song]);
  const facts = stemSongListFacts(song);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${song.title}, ${facts}${added ? ', in this set' : ''}`}
      style={styles.row}
      onPress={press}
    >
      <View style={styles.tile}>
        <Icon name="stems" size="listTile" color={ink} />
      </View>
      <View style={styles.text}>
        <EllipsizedText style={styles.title}>{song.title}</EllipsizedText>
        <EllipsizedText style={styles.facts}>{facts}</EllipsizedText>
      </View>
      <Icon
        name={added ? 'check' : 'add'}
        size="listTile"
        color={added ? ink : 'text2'}
      />
    </Pressable>
  );
}

interface StemTabProps {
  readonly setlistId: number;
  readonly inSet: ReadonlySet<number>;
  readonly onError: (error: string | null) => void;
  readonly onAddStemSongs: () => void;
}

function StemTab({ setlistId, inSet, onError, onAddStemSongs }: StemTabProps) {
  const songs = useStemSongs();
  const addStemToSetlist = useLibrary((s) => s.addStemToSetlist);
  const add = useCallback(
    (song: LibraryStemSetRow) => {
      void guarded(onError, 'Could not add the song. Try again.', () =>
        addStemToSetlist(setlistId, song.id),
      );
    },
    [onError, addStemToSetlist, setlistId],
  );
  if (songs.size === 0)
    return (
      <EmptyState
        variant="list"
        icon="stems"
        title="No stem songs yet"
        reason="Bring stem songs from StemDeck or a folder on this phone, then add them here."
        action={{ label: 'Add stem songs', onPress: onAddStemSongs }}
        actionIcon="add"
      />
    );
  return (
    <>
      <View>
        {[...songs.values()].map((song) => (
          <StemPickRow
            key={song.id}
            song={song}
            added={inSet.has(song.id)}
            onAdd={add}
          />
        ))}
      </View>
      <SheetHint>{STEM_ADD_HINT}</SheetHint>
    </>
  );
}

export interface AddSongSheetProps {
  readonly visible: boolean;
  readonly setlistId: number;
  readonly stemSetIds: readonly number[];
  readonly metronomeActions: readonly SheetAction[];
  readonly error: string | null;
  readonly bottomInset: number;
  readonly onError: (error: string | null) => void;
  readonly onDismiss: () => void;
  readonly onAddStemSongs: () => void;
}

function useLeaveForStemSongs(
  visible: boolean,
  onDismiss: () => void,
  onAddStemSongs: () => void,
) {
  const { after, closed } = useAfterSheetClosed(visible);
  const leave = useCallback(() => {
    after(onAddStemSongs);
    onDismiss();
  }, [after, onAddStemSongs, onDismiss]);
  return { leave, closed };
}

export function AddSongSheet(props: AddSongSheetProps) {
  const styles = useStyles();
  const [kind, setKind] = useState<Kind>(METRONOME);
  const inSet = useMemo(() => new Set(props.stemSetIds), [props.stemSetIds]);
  const exit = useLeaveForStemSongs(
    props.visible,
    props.onDismiss,
    props.onAddStemSongs,
  );
  return (
    <Sheet
      visible={props.visible}
      title="Add song"
      dismissLabel="Close Add song"
      bottomInset={props.bottomInset}
      onDismiss={props.onDismiss}
      onClosed={exit.closed}
    >
      <View style={styles.body}>
        <SegmentedControl
          size="large"
          options={KIND_OPTIONS}
          selected={kind}
          accessibilityLabel="Kind of song"
          onSelect={setKind}
        />
        {kind === METRONOME ? (
          <ActionStack actions={props.metronomeActions} />
        ) : (
          <StemTab
            setlistId={props.setlistId}
            inSet={inSet}
            onError={props.onError}
            onAddStemSongs={exit.leave}
          />
        )}
        {props.error === null ? null : <SheetHint>{props.error}</SheetHint>}
        <Button variant="tonal" label="Done" onPress={props.onDismiss} />
      </View>
    </Sheet>
  );
}
