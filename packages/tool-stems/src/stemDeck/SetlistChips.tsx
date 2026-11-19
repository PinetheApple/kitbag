import { Chip, createThemedStyles, space } from '@kitbag/core-design';
import {
  setlistSongs,
  useStemDeck,
  type StemDeckCatalog,
  type StemDeckSetlist,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';

import { setlistLabel } from './logic/songFacts.ts';

const ALL_SONGS = 'All songs';

const useStyles = createThemedStyles(() => ({
  row: { gap: space.chipGap, paddingHorizontal: space.screenInset },
  strip: { flexGrow: 0, marginHorizontal: -space.screenInset },
}));

interface SetlistChipProps {
  readonly catalog: StemDeckCatalog;
  readonly setlist: StemDeckSetlist;
  readonly active: boolean;
  readonly onPick: (id: string) => void;
}

function SetlistChip({ catalog, setlist, active, onPick }: SetlistChipProps) {
  const pick = useCallback(() => {
    onPick(setlist.id);
  }, [onPick, setlist.id]);
  return (
    <Chip
      size="large"
      icon="setlist"
      active={active}
      label={setlistLabel(
        setlist.name,
        setlistSongs(catalog, setlist.id).length,
      )}
      onPress={pick}
    />
  );
}

export function SetlistChips({
  catalog,
}: {
  readonly catalog: StemDeckCatalog;
}) {
  const styles = useStyles();
  const setlistId = useStemDeck((s) => s.setlistId);
  const setSetlist = useStemDeck((s) => s.setSetlist);
  const showAll = useCallback(() => {
    setSetlist(null);
  }, [setSetlist]);
  if (catalog.setlists.length === 0) return null;
  return (
    <ScrollView
      horizontal
      style={styles.strip}
      contentContainerStyle={styles.row}
      showsHorizontalScrollIndicator={false}
    >
      <Chip
        size="large"
        active={setlistId === null}
        label={ALL_SONGS}
        onPress={showAll}
      />
      {catalog.setlists.map((setlist) => (
        <SetlistChip
          key={setlist.id}
          catalog={catalog}
          setlist={setlist}
          active={setlist.id === setlistId}
          onPick={setSetlist}
        />
      ))}
    </ScrollView>
  );
}
