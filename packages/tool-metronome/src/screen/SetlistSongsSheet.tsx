import {
  Badge,
  Button,
  createThemedStyles,
  metronomeMix,
  metronomeSheet,
  mixHex,
  Sheet,
  size,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';
import { useLibrary, type SetlistEntry } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  songListHint,
  songListRows,
  type ActiveSet,
  type SongListRow,
} from '../logic/setlistChip.ts';

const NO_ENTRIES: readonly SetlistEntry[] = [];

const useStyles = createThemedStyles((theme) => ({
  hint: {
    ...textStyle(textRoles.songArtist),
    color: theme.color.text2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sectionGap,
    minHeight: metronomeSheet.songRow,
    paddingHorizontal: metronomeSheet.songRowH,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  rowNow: {
    borderRadius: metronomeSheet.songRowRadius,
    borderBottomColor: TRANSPARENT,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface1,
      metronomeMix.songNow,
    ),
  },
  number: {
    ...textStyle(textRoles.setlistSongMeta),
    width: metronomeSheet.songNumberWidth,
    textAlign: 'right',
    color: theme.color.text3,
  },
  name: {
    ...textStyle(textRoles.menuRow),
    flex: 1,
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
}

function SongRow({ row, onPick }: SongRowProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onPick(row);
  }, [onPick, row]);
  const spoken = `${row.number}. ${row.name}, ${row.bpm} BPM`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.now ? `${spoken}, now loaded` : spoken}
      accessibilityState={{ selected: row.now }}
      style={[styles.row, row.now && styles.rowNow]}
      onPress={handlePress}
    >
      <Text style={styles.number}>{row.number}</Text>
      <Text style={[styles.name, row.now && styles.nameNow]}>{row.name}</Text>
      {row.now ? (
        <Badge tone="accent" label="NOW" />
      ) : (
        <Text style={styles.bpm}>{row.bpm}</Text>
      )}
    </Pressable>
  );
}

export interface SetlistSongsSheetProps {
  readonly visible: boolean;
  readonly set: ActiveSet;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function SetlistSongsSheet({
  visible,
  set,
  bottomInset,
  onDismiss,
}: SetlistSongsSheetProps) {
  const styles = useStyles();
  const entries = useLibrary((s) => s.entries[set.id] ?? NO_ENTRIES);
  const loadedItemId = useLibrary((s) => s.loaded?.itemId ?? null);
  const loadSong = useLibrary((s) => s.loadSong);
  const leaveSetlist = useLibrary((s) => s.leaveSetlist);
  const rows = useMemo(
    () => songListRows(entries, loadedItemId),
    [entries, loadedItemId],
  );
  const handlePick = useCallback(
    (row: SongListRow) => {
      onDismiss();
      void loadSong(row.presetId, row.itemId, set.id);
    },
    [onDismiss, loadSong, set.id],
  );
  const handleLeave = useCallback(() => {
    onDismiss();
    void leaveSetlist();
  }, [onDismiss, leaveSetlist]);
  return (
    <Sheet
      visible={visible}
      title={set.name}
      dismissLabel="Close song list"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <Text style={styles.hint}>{songListHint(set)}</Text>
      <View>
        {rows.map((row) => (
          <SongRow key={row.itemId} row={row} onPick={handlePick} />
        ))}
      </View>
      <Button
        variant="ghost"
        size="target"
        icon="close"
        label="Leave setlist"
        onPress={handleLeave}
      />
    </Sheet>
  );
}
