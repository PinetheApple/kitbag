import {
  Badge,
  Button,
  createThemedStyles,
  metronomeSheet,
  metronome,
  Sheet,
  SheetHint,
  size,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';
import {
  useLibrary,
  useMetronome,
  useStemSongs,
  type ActiveSet,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { STEMS_BADGE } from '../logic/setlistEntry.ts';
import {
  songListHint,
  songListRows,
  STEM_SONG_HINT,
  type SongListRow,
} from '../logic/songList.ts';
import { type ErrorSetter } from '../library/sheets.tsx';
import { nowRowA11yLabel } from '../logic/setlistChip.ts';
import { useSheetStyles } from './sheetStyles.ts';
import {
  NowRowActions,
  UnsavedDot,
  useLoadedSongUnsaved,
} from './UnsavedChanges.tsx';

const NO_ENTRIES: readonly SetlistEntry[] = [];
const UNSAVED_NAME_LINES = 2;
const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    columnGap: space.sectionGap,
    rowGap: space.controlGap,
    minHeight: metronomeSheet.songRow,
    paddingHorizontal: metronomeSheet.songRowH,
    paddingVertical: space.controlGap,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  rowNow: {
    borderRadius: metronomeSheet.songRowRadius,
    borderBottomColor: TRANSPARENT,
    backgroundColor: theme.songNowFill,
  },
  number: {
    ...textStyle(textRoles.setlistSongMeta),
    width: metronomeSheet.songNumberWidth,
    textAlign: 'right',
    color: theme.color.text3,
  },
  numberUnsaved: {
    width: 'auto',
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sectionGap,
    marginLeft: 'auto',
  },
  nameLine: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: metronomeSheet.nowNameMin,
    minWidth: metronomeSheet.nowNameMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: metronome.unsavedDotGap,
  },
  name: {
    ...textStyle(textRoles.menuRow),
    flexShrink: 1,
    minWidth: 0,
    color: theme.color.text,
  },
  nameNow: textStyle(textRoles.menuRowNow),
  bpm: {
    ...textStyle(textRoles.setlistSongMeta),
    color: theme.color.text2,
  },
}));

interface SongRowProps {
  readonly row: SongListRow;
  readonly onPick: (row: SongListRow) => void;
  readonly onSaveError: ErrorSetter;
}

function SongRow({
  row,
  onPick,
  onSaveError,
  unsaved,
}: SongRowProps & { readonly unsaved: boolean }) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onPick(row);
  }, [onPick, row]);
  const spoken =
    row.bpm === null
      ? `${row.number}. ${row.name}, stem song`
      : `${row.number}. ${row.name}, ${row.bpm} BPM`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.now ? nowRowA11yLabel(spoken, unsaved) : spoken}
      accessibilityState={{ selected: row.now }}
      style={[styles.row, row.now && styles.rowNow]}
      onPress={handlePress}
    >
      <Text style={[styles.number, unsaved && styles.numberUnsaved]}>
        {row.number}
      </Text>
      <View style={styles.nameLine}>
        <Text
          style={[styles.name, row.now && styles.nameNow]}
          numberOfLines={unsaved ? UNSAVED_NAME_LINES : undefined}
        >
          {row.name}
        </Text>
        {unsaved ? <UnsavedDot /> : null}
      </View>
      <View style={styles.trail}>
        {unsaved ? <NowRowActions onError={onSaveError} /> : null}
        {row.now ? (
          <View>
            <Badge tone="accent" variant="filled" label="NOW" />
          </View>
        ) : row.bpm === null ? (
          <View>
            <Badge label={STEMS_BADGE} />
          </View>
        ) : (
          <Text style={styles.bpm}>{row.bpm}</Text>
        )}
      </View>
    </Pressable>
  );
}

function NowSongRow(props: SongRowProps) {
  const unsaved = useLoadedSongUnsaved();
  return <SongRow {...props} unsaved={unsaved} />;
}

export interface SetlistSongsSheetProps {
  readonly visible: boolean;
  readonly set: ActiveSet;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onOpenStemSet?: ((stemSetId: number) => void) | undefined;
}

function useStemPick(
  setlistId: number,
  onOpenStemSet: SetlistSongsSheetProps['onOpenStemSet'],
) {
  const openStemEntry = useLibrary((s) => s.openStemEntry);
  const stop = useMetronome((s) => s.stop);
  const leavingFor = useRef<number | null>(null);
  const pick = useCallback(
    (row: SongListRow) => {
      if (row.stemSetId === null) return;
      leavingFor.current = row.stemSetId;
      stop();
      void openStemEntry(row.itemId, setlistId);
    },
    [openStemEntry, stop, setlistId],
  );
  const closed = useCallback(() => {
    const stemSetId = leavingFor.current;
    leavingFor.current = null;
    if (stemSetId !== null) onOpenStemSet?.(stemSetId);
  }, [onOpenStemSet]);
  return { pick, closed };
}

export function SetlistSongsSheet({
  visible,
  set,
  bottomInset,
  onDismiss,
  onOpenStemSet,
}: SetlistSongsSheetProps) {
  const sheetStyles = useSheetStyles();
  const entries = useLibrary((s) => s.entries[set.id] ?? NO_ENTRIES);
  const loadedItemId = useLibrary((s) => s.loaded?.itemId ?? null);
  const loadSong = useLibrary((s) => s.loadSong);
  const leaveSetlist = useLibrary((s) => s.leaveSetlist);
  const stems = useStemSongs();
  const stemPick = useStemPick(set.id, onOpenStemSet);
  const [saveError, setSaveError] = useState<string | null>(null);
  const rows = useMemo(
    () => songListRows(entries, loadedItemId, stems),
    [entries, loadedItemId, stems],
  );
  const hasStems = rows.some((row) => row.stemSetId !== null);
  const handlePick = useCallback(
    (row: SongListRow) => {
      onDismiss();
      if (row.presetId === null) stemPick.pick(row);
      else void loadSong(row.presetId, row.itemId, set.id);
    },
    [onDismiss, loadSong, set.id, stemPick],
  );
  const handleLeave = useCallback(() => {
    onDismiss();
    void leaveSetlist();
  }, [onDismiss, leaveSetlist]);
  return (
    <Sheet
      visible={visible}
      title={set.name}
      titleSize="large"
      dismissLabel="Close song list"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
      onClosed={stemPick.closed}
    >
      <Text style={sheetStyles.songHint}>{songListHint(set)}</Text>
      <View>
        {rows.map((row) =>
          row.now ? (
            <NowSongRow
              key={row.itemId}
              row={row}
              onPick={handlePick}
              onSaveError={setSaveError}
            />
          ) : (
            <SongRow
              key={row.itemId}
              row={row}
              onPick={handlePick}
              onSaveError={setSaveError}
              unsaved={false}
            />
          ),
        )}
      </View>
      {hasStems ? <SheetHint>{STEM_SONG_HINT}</SheetHint> : null}
      {saveError === null ? null : <SheetHint>{saveError}</SheetHint>}
      <Button
        variant="ghost"
        size="target"
        icon="close"
        iconSize="caret"
        label="Leave setlist"
        onPress={handleLeave}
      />
    </Sheet>
  );
}
