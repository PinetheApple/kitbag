import {
  AppBar,
  Button,
  CheckAllRow,
  createThemedStyles,
  SearchField,
  Sheet,
  SheetHint,
  space,
  type AppBarAction,
} from '@kitbag/core-design';
import {
  displayAddress,
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
  listSubtitle,
  selectedText,
  unavailableText,
} from './logic/songFacts.ts';
import { SetlistChips } from './SetlistChips.tsx';
import { SongPickRow } from './SongPickRow.tsx';
import { useStemDeckStyles, type StemDeckInsets } from './stemDeckStyles.ts';

const LOADING = 'Getting the song list from StemDeck…';
const NO_SONGS = 'StemDeck has no finished songs yet.';
const NO_MATCH = 'No StemDeck songs match this search.';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

export interface SongListScreenProps {
  readonly insets: StemDeckInsets;
  readonly onBack: () => void;
  readonly onImporting: () => void;
}

function SelectAll({ catalog }: { readonly catalog: StemDeckCatalog }) {
  const setlistId = useStemDeck((s) => s.setlistId);
  const query = useStemDeck((s) => s.query);
  const selected = useStemDeck((s) => s.selected);
  const selectSongs = useStemDeck((s) => s.selectSongs);
  const selectable = useMemo(
    () => selectableIds(visibleSongs(catalog, setlistId, query)),
    [catalog, setlistId, query],
  );
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
  const query = useStemDeck((s) => s.query);
  const selected = useStemDeck((s) => s.selected);
  const toggleSong = useStemDeck((s) => s.toggleSong);
  const songs = useMemo(
    () => visibleSongs(catalog, setlistId, query),
    [catalog, setlistId, query],
  );
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

function ReplaceSheet({
  bottomInset,
  onImporting,
}: {
  readonly bottomInset: number;
  readonly onImporting: () => void;
}) {
  const styles = useStyles();
  const prompt = useStemDeck((s) => s.replacePrompt);
  const replaceInLibrary = useStemDeck((s) => s.replaceInLibrary);
  const keepInLibrary = useStemDeck((s) => s.keepInLibrary);
  const dismissReplace = useStemDeck((s) => s.dismissReplace);
  const titles = prompt?.titles ?? [];
  const [first] = titles;
  const replace = useCallback(() => {
    void replaceInLibrary().then(onImporting);
  }, [replaceInLibrary, onImporting]);
  const keep = useCallback(() => {
    void keepInLibrary().then(onImporting);
  }, [keepInLibrary, onImporting]);
  const one = titles.length === 1 && first !== undefined;
  return (
    <Sheet
      visible={prompt !== null}
      title={
        one ? `Replace “${first}”?` : `Replace ${String(titles.length)} songs?`
      }
      titleSize="large"
      dismissLabel="Don’t import"
      bottomInset={bottomInset}
      onDismiss={dismissReplace}
    >
      <SheetHint size="large">
        {one
          ? `“${first}” is already in your library. Replacing it removes that song’s stems, analysis and mix, and adds this copy; your names for the song and its stems are kept. This cannot be undone.`
          : `${titles.join(', ')} are already in your library. Replacing them removes their stems, analysis and mix, and adds these copies; your names for the songs and their stems are kept. This cannot be undone.`}
      </SheetHint>
      <View style={styles.actions}>
        <Button
          fill
          size="target"
          variant="ghost"
          label="Keep current"
          onPress={keep}
        />
        <Button
          fill
          size="target"
          variant="destructive"
          label="Replace"
          onPress={replace}
        />
      </View>
    </Sheet>
  );
}

function useLeaveOnFailure(onBack: () => void) {
  const failed = useStemDeck((s) => s.connection.status === 'failed');
  useEffect(() => {
    if (failed) onBack();
  }, [failed, onBack]);
}

function useImport(onImporting: () => void) {
  const importSelected = useStemDeck((s) => s.importSelected);
  const markUnityNoticeSeen = useStemDeck((s) => s.markUnityNoticeSeen);
  const importStarted = useNotificationPermission((s) => s.importStarted);
  return useCallback(() => {
    void importStarted();
    markUnityNoticeSeen();
    void importSelected().then(() => {
      if (stemDeckStore.getState().replacePrompt === null) onImporting();
    });
  }, [importStarted, markUnityNoticeSeen, importSelected, onImporting]);
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
  useLeaveOnFailure(onBack);
  const startImport = useImport(onImporting);
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
  const frame = useMemo(
    () => [styles.screen, { paddingTop: insets.top }],
    [styles.screen, insets.top],
  );
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
      <ReplaceSheet bottomInset={insets.bottom} onImporting={onImporting} />
    </View>
  );
}
