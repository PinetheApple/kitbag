import {
  AppBar,
  Button,
  CheckAllRow,
  SearchField,
  Sheet,
  SheetHint,
  type AppBarAction,
} from '@kitbag/core-design';
import {
  displayAddress,
  REPLACE_LABELS,
  selectableIds,
  stemDeckStore,
  useNotificationPermission,
  useStemDeck,
  visibleSongs,
  type StemDeckCatalog,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ImportDock } from './ImportDock.tsx';
import {
  REPLACE_SHEET_TEXT,
  replaceHint,
  replaceSheetTitle,
} from './logic/replaceText.ts';
import {
  listSubtitle,
  selectedText,
  unavailableText,
} from './logic/songFacts.ts';
import { SetlistChips } from './SetlistChips.tsx';
import { SongPickRow } from './SongPickRow.tsx';
import {
  useInset,
  useStemDeckStyles,
  type StemDeckInsets,
} from './stemDeckStyles.ts';

const LOADING = 'Getting the song list from StemDeck…';
const NO_SONGS = 'StemDeck has no finished songs yet.';
const NO_MATCH = 'No StemDeck songs match this search.';

export interface SongListScreenProps {
  readonly insets: StemDeckInsets;
  readonly onBack: () => void;
  readonly onImporting: () => void;
}

function useVisibleSongs(catalog: StemDeckCatalog) {
  const setlistId = useStemDeck((s) => s.setlistId);
  const query = useStemDeck((s) => s.query);
  return useMemo(
    () => visibleSongs(catalog, setlistId, query),
    [catalog, setlistId, query],
  );
}

function SelectAll({ catalog }: { readonly catalog: StemDeckCatalog }) {
  const selected = useStemDeck((s) => s.selected);
  const selectSongs = useStemDeck((s) => s.selectSongs);
  const songs = useVisibleSongs(catalog);
  const selectable = useMemo(() => selectableIds(songs), [songs]);
  const all =
    selectable.length > 0 && selectable.every((id) => selected.includes(id));
  const toggle = useCallback(() => {
    const others = selected.filter((id) => !selectable.includes(id));
    selectSongs(all ? others : [...others, ...selectable]);
  }, [all, selectSongs, selectable, selected]);
  return (
    <CheckAllRow
      label="Select all"
      aside={selectedText(selected.length)}
      checked={all}
      disabled={selectable.length === 0}
      onToggle={toggle}
    />
  );
}

function SongRows({ catalog }: { readonly catalog: StemDeckCatalog }) {
  const styles = useStemDeckStyles();
  const setlistId = useStemDeck((s) => s.setlistId);
  const selected = useStemDeck((s) => s.selected);
  const toggleSong = useStemDeck((s) => s.toggleSong);
  const songs = useVisibleSongs(catalog);
  if (catalog.songs.length === 0)
    return <Text style={styles.hint}>{NO_SONGS}</Text>;
  return (
    <View style={styles.list}>
      {songs.length === 0 ? (
        <Text style={styles.listNote}>{NO_MATCH}</Text>
      ) : (
        songs.map((song) => (
          <SongPickRow
            key={song.jobId}
            song={song}
            picked={selected.includes(song.jobId)}
            onToggle={toggleSong}
          />
        ))
      )}
      {setlistId === null && catalog.unavailable > 0 ? (
        <Text style={styles.listNote}>
          {unavailableText(catalog.unavailable)}
        </Text>
      ) : null}
    </View>
  );
}

function useAnswer(
  choose: () => Promise<boolean>,
  onStarted: (started: boolean) => void,
) {
  return useCallback(() => {
    void choose().then((started) => {
      if (stemDeckStore.getState().replacePrompt === null) onStarted(started);
    });
  }, [choose, onStarted]);
}

function ReplaceSheet({
  bottomInset,
  onStarted,
}: {
  readonly bottomInset: number;
  readonly onStarted: (started: boolean) => void;
}) {
  const styles = useStemDeckStyles();
  const prompt = useStemDeck((s) => s.replacePrompt);
  const replaceInLibrary = useStemDeck((s) => s.replaceInLibrary);
  const keepInLibrary = useStemDeck((s) => s.keepInLibrary);
  const keepBothCopies = useStemDeck((s) => s.keepBoth);
  const replace = useAnswer(replaceInLibrary, onStarted);
  const keep = useAnswer(keepInLibrary, onStarted);
  const keepBoth = useAnswer(keepBothCopies, onStarted);
  const dismissReplace = useStemDeck((s) => s.dismissReplace);
  const titles = prompt?.titles ?? [];
  const match = prompt?.match ?? 'job';
  const sameSong = match === 'song';
  return (
    <Sheet
      visible={prompt !== null}
      title={replaceSheetTitle(titles)}
      titleSize="large"
      dismissLabel={REPLACE_SHEET_TEXT.dismiss}
      bottomInset={bottomInset}
      onDismiss={dismissReplace}
    >
      <SheetHint size="large">{replaceHint(titles, match)}</SheetHint>
      <View style={styles.actions}>
        <Button
          fill
          size="target"
          variant="ghost"
          label={
            sameSong ? REPLACE_SHEET_TEXT.skip : REPLACE_LABELS.keepCurrent
          }
          onPress={keep}
        />
        {sameSong ? (
          <Button
            fill
            size="target"
            variant="tonal"
            label={REPLACE_LABELS.keepBoth}
            onPress={keepBoth}
          />
        ) : null}
        <Button
          fill
          size="target"
          variant="destructive"
          label={REPLACE_LABELS.replace}
          onPress={replace}
        />
      </View>
    </Sheet>
  );
}

function useLeaveWhenDisconnected(onBack: () => void) {
  const gone = useStemDeck(
    (s) =>
      s.connection.status === 'failed' ||
      (s.connection.status === 'idle' && s.catalog === null),
  );
  useEffect(() => {
    if (gone) onBack();
  }, [gone, onBack]);
}

function useImport(onImporting: () => void) {
  const importSelected = useStemDeck((s) => s.importSelected);
  const markUnityNoticeSeen = useStemDeck((s) => s.markUnityNoticeSeen);
  const importStarted = useNotificationPermission((s) => s.importStarted);
  const onStarted = useCallback(
    (started: boolean) => {
      if (started) void importStarted();
      onImporting();
    },
    [importStarted, onImporting],
  );
  const startImport = useCallback(() => {
    markUnityNoticeSeen();
    void importSelected().then((started) => {
      if (stemDeckStore.getState().replacePrompt === null) onStarted(started);
    });
  }, [markUnityNoticeSeen, importSelected, onStarted]);
  return { startImport, onStarted };
}

export function SongListScreen({
  insets,
  onBack,
  onImporting,
}: SongListScreenProps) {
  const styles = useStemDeckStyles();
  const catalog = useStemDeck((s) => s.catalog);
  const connection = useStemDeck((s) => s.connection);
  const query = useStemDeck((s) => s.query);
  const setQuery = useStemDeck((s) => s.setQuery);
  const refreshCatalog = useStemDeck((s) => s.refreshCatalog);
  const selectedCount = useStemDeck((s) => s.selected.length);
  const noteSeen = useStemDeck((s) => s.unityNoticeSeen);
  useLeaveWhenDisconnected(onBack);
  const { startImport, onStarted } = useImport(onImporting);
  const clear = useCallback(() => {
    setQuery('');
  }, [setQuery]);
  const refresh = useCallback(() => {
    void refreshCatalog();
  }, [refreshCatalog]);
  const actions: readonly AppBarAction[] = useMemo(
    () => [
      { icon: 'analyzing', label: 'Refresh the song list', onPress: refresh },
    ],
    [refresh],
  );
  const origin = connection.status === 'connected' ? connection.origin : null;
  const subtitle =
    origin === null || catalog === null
      ? undefined
      : listSubtitle(
          displayAddress(origin),
          catalog.songs.length + catalog.unavailable,
        );
  const frame = useInset(styles.screen, 'paddingTop', insets.top);
  return (
    <View style={frame}>
      <AppBar
        flush
        title="StemDeck"
        subtitle={subtitle}
        onBack={onBack}
        actions={actions}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {catalog === null ? (
          <Text style={styles.hint}>{LOADING}</Text>
        ) : (
          <>
            <SearchField
              variant="list"
              value={query}
              onChangeText={setQuery}
              placeholder="Search StemDeck songs"
              accessibilityLabel="Search StemDeck songs and artists"
              onClear={clear}
            />
            <SetlistChips catalog={catalog} />
            <SelectAll catalog={catalog} />
            <SongRows catalog={catalog} />
          </>
        )}
      </ScrollView>
      <ImportDock
        count={selectedCount}
        showNote={!noteSeen}
        bottomInset={insets.bottom}
        onImport={startImport}
      />
      <ReplaceSheet bottomInset={insets.bottom} onStarted={onStarted} />
    </View>
  );
}
