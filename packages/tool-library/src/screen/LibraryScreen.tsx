import {
  AppBar,
  Button,
  Card,
  Chip,
  ChipRow,
  createThemedStyles,
  EmptyState,
  FloatingActionButton,
  SearchField,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import {
  filterRows,
  LIBRARY_CHIPS,
  useSongLibrary,
  type LibraryChip,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { copyingText, noticeText } from '../logic/notices.ts';
import { CHIP_LABELS } from '../logic/rowText.ts';
import { LibraryRowView } from './LibraryRowView.tsx';
import {
  LibrarySheets,
  useLibraryMenu,
  type LibraryMenu,
} from './LibrarySheets.tsx';

export interface LibraryScreenInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface LibraryScreenProps {
  readonly insets: LibraryScreenInsets;
  readonly initialChip?: LibraryChip;
  readonly onBack: () => void;
  readonly onOpenStemSet: (id: number) => void;
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: space.screenInset,
    gap: space.sectionGap,
  },
  content: { gap: space.sectionGap, flexGrow: 1 },
  cardBody: { gap: space.controlGap, alignItems: 'flex-start' },
  cardText: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

function FilterChip({ chip }: { readonly chip: LibraryChip }) {
  const active = useSongLibrary((s) => s.chip === chip);
  const setChip = useSongLibrary((s) => s.setChip);
  const select = useCallback(() => {
    setChip(chip);
  }, [setChip, chip]);
  return (
    <Chip
      label={CHIP_LABELS[chip]}
      active={active}
      accessibilityLabel={`Show ${CHIP_LABELS[chip]}`}
      onPress={select}
    />
  );
}

function SearchBar() {
  const query = useSongLibrary((s) => s.query);
  const setQuery = useSongLibrary((s) => s.setQuery);
  const clear = useCallback(() => {
    setQuery('');
  }, [setQuery]);
  return (
    <SearchField
      value={query}
      onChangeText={setQuery}
      placeholder="Search songs, artists…"
      accessibilityLabel="Search songs and artists"
      onClear={clear}
    />
  );
}

function ImportingCard() {
  const styles = useStyles();
  const importing = useSongLibrary((s) => s.importing);
  if (importing.length === 0) return null;
  return (
    <Card>
      <Text accessibilityLiveRegion="polite" style={styles.cardText}>
        {copyingText(importing)}
      </Text>
    </Card>
  );
}

function NoticeCard() {
  const styles = useStyles();
  const notice = useSongLibrary((s) => s.notice);
  const dismiss = useSongLibrary((s) => s.dismissNotice);
  if (notice === null) return null;
  const { status, text } = noticeText(notice);
  const tone = notice.kind === 'bundleRefused' ? 'warning' : 'danger';
  return (
    <Card emphasis={tone} statusIcon="warning" statusLabel={status}>
      <View style={styles.cardBody}>
        <Text accessibilityLiveRegion="polite" style={styles.cardText}>
          {text}
        </Text>
        <Button label="Dismiss" variant="ghost" onPress={dismiss} />
      </View>
    </Card>
  );
}

function LibraryUnavailable() {
  const refresh = useSongLibrary((s) => s.refresh);
  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);
  return (
    <EmptyState
      icon="warning"
      title="Your songs could not be opened"
      reason="The song library failed to load. The metronome and tuner still work."
      actionLabel="Try again"
      onAction={retry}
    />
  );
}

function NothingMatches() {
  const styles = useStyles();
  return (
    <Card>
      <Text style={styles.cardText}>
        No songs match this search and filter.
      </Text>
    </Card>
  );
}

function SongList({
  onActions,
  onOpenStemSet,
}: {
  readonly onActions: LibraryMenu['openActions'];
  readonly onOpenStemSet: (id: number) => void;
}) {
  const rows = useSongLibrary((s) => s.rows);
  const query = useSongLibrary((s) => s.query);
  const chip = useSongLibrary((s) => s.chip);
  const shown = useMemo(
    () => filterRows(rows, query, chip),
    [rows, query, chip],
  );
  if (shown.length === 0) return <NothingMatches />;
  return shown.map((row) => (
    <LibraryRowView
      key={`${row.kind}-${String(row.id)}`}
      row={row}
      onActions={onActions}
      onOpenStemSet={onOpenStemSet}
    />
  ));
}

function LibraryBody({
  menu,
  onOpenStemSet,
}: {
  readonly menu: LibraryMenu;
  readonly onOpenStemSet: (id: number) => void;
}) {
  const ready = useSongLibrary((s) => s.ready);
  const failed = useSongLibrary((s) => s.failed);
  const empty = useSongLibrary((s) => s.rows.length === 0);
  const importing = useSongLibrary((s) => s.importing.length > 0);
  if (failed) return <LibraryUnavailable />;
  if (!ready) return null;
  if (empty && !importing)
    return (
      <EmptyState
        icon="songs"
        title="Add your first song"
        reason="Import an audio file. Its beats are found in the background, so the metronome can lock to it."
        actionLabel="Import"
        onAction={menu.openImport}
      />
    );
  return (
    <>
      <SearchBar />
      <ChipRow>
        {LIBRARY_CHIPS.map((chip) => (
          <FilterChip key={chip} chip={chip} />
        ))}
      </ChipRow>
      <SongList onActions={menu.openActions} onOpenStemSet={onOpenStemSet} />
    </>
  );
}

function useEntry(initialChip: LibraryChip | undefined) {
  const refresh = useSongLibrary((s) => s.refresh);
  const setChip = useSongLibrary((s) => s.setChip);
  useEffect(() => {
    if (initialChip !== undefined) setChip(initialChip);
  }, [initialChip, setChip]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
}

export function LibraryScreen({
  insets,
  initialChip,
  onBack,
  onOpenStemSet,
}: LibraryScreenProps) {
  const styles = useStyles();
  useEntry(initialChip);
  const menu = useLibraryMenu();
  const padding = useMemo(
    () => ({
      paddingTop: space.screenInset + insets.top,
      paddingBottom: space.screenInset + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );
  return (
    <View style={[styles.screen, padding]}>
      <AppBar title="Songs" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <NoticeCard />
        <ImportingCard />
        <LibraryBody menu={menu} onOpenStemSet={onOpenStemSet} />
      </ScrollView>
      <FloatingActionButton
        icon="add"
        accessibilityLabel="Import a song"
        onPress={menu.openImport}
      />
      <LibrarySheets menu={menu} bottomInset={insets.bottom} />
    </View>
  );
}
