import {
  AppBar,
  Badge,
  Card,
  Chip,
  ChipRow,
  DragListRow,
  EmptyState,
  SheetHint,
} from '@kitbag/core-design';
import {
  isPresetEntry,
  stemFacts,
  STEMS_BADGE,
  stemSongTitle,
  useLibrary,
  useMetronome,
  useStemSongs,
  type PresetSetlistEntry,
  type SetlistEntry,
  type StemSetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { setlistTitle, songSubtitle } from '../logic/songSummary.ts';
import { useCustomSoundViews } from '../screen/CustomSounds.tsx';
import type { ShellMeasuredInsets } from '../screen/MetronomeScreen.tsx';
import { DetailSheets, useDetailMenu, type DetailMenu } from './DetailMenu.tsx';
import { ScreenFrame } from './ScreenFrame.tsx';
import { CHANGE_NOT_SAVED, REMOVE_FROM_SET } from './setlistCopy.ts';
import { ActionsSheet, guarded } from './sheets.tsx';
import {
  isSongTarget,
  SongMenuSheets,
  useSongMenu,
  type SongMenu,
} from './SongMenu.tsx';
import { useOpenStemPlayer } from '../screen/useOpenStemPlayer.ts';
import { useLibraryRefresh } from './useLibraryRefresh.ts';

const NO_ENTRIES: readonly SetlistEntry[] = [];

export interface SetlistDetailScreenProps {
  readonly setlistId: number;
  readonly insets: ShellMeasuredInsets;
  readonly onBack: () => void;
  readonly onEditPreset: (presetId: number) => void;
  readonly onLoaded: () => void;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onAddStemSongs: () => void;
}

interface EntryRowProps {
  readonly entry: PresetSetlistEntry;
  readonly index: number;
  readonly count: number;
  readonly setlistId: number;
  readonly songMenu: SongMenu;
  readonly onLoaded: () => void;
}

function useDrag(index: number, count: number, setlistId: number) {
  const reorder = useLibrary((s) => s.reorder);
  const onMove = useCallback(
    (from: number, to: number) => {
      void reorder(setlistId, from, to);
    },
    [reorder, setlistId],
  );
  return useMemo(() => ({ index, count, onMove }), [index, count, onMove]);
}

function useEntryRow({
  entry,
  index,
  count,
  setlistId,
  songMenu,
  onLoaded,
}: EntryRowProps) {
  const { item, preset } = entry;
  const loadSong = useLibrary((s) => s.loadSong);
  const drag = useDrag(index, count, setlistId);
  const load = useCallback(() => {
    void loadSong(preset.id, item.id, setlistId).then(onLoaded);
  }, [loadSong, preset.id, item.id, setlistId, onLoaded]);
  const actions = useCallback(() => {
    songMenu.openActions({ preset, itemId: item.id });
  }, [songMenu, preset, item.id]);
  return { drag, load, actions };
}

function NowBadge() {
  return <Badge tone="accent" label="NOW" />;
}

interface StemEntryRowProps {
  readonly entry: StemSetlistEntry;
  readonly index: number;
  readonly count: number;
  readonly setlistId: number;
  readonly menuOpen: boolean;
  readonly onOpen: (entry: StemSetlistEntry) => void;
  readonly onActions: (entry: StemSetlistEntry, name: string) => void;
}

function useStemEntryText(stemSetId: number) {
  const stems = useStemSongs();
  return {
    name: stemSongTitle(stemSetId, stems),
    facts: stemFacts(stemSetId, stems),
  };
}

function StemEntryRow(props: StemEntryRowProps) {
  const { entry, index, count, setlistId, onOpen, onActions } = props;
  const now = useLibrary((s) => s.loaded?.itemId === entry.item.id);
  const drag = useDrag(index, count, setlistId);
  const { name, facts } = useStemEntryText(entry.stemSetId);
  const open = useCallback(() => {
    onOpen(entry);
  }, [onOpen, entry]);
  const actions = useCallback(() => {
    onActions(entry, name);
  }, [onActions, entry, name]);
  const spoken = `${String(index + 1)}. ${name}, stem song, ${facts}`;
  return (
    <DragListRow
      title={name}
      subtitle={facts}
      active={now}
      menuOpen={props.menuOpen}
      reorder={drag}
      trailing={
        <View>
          <Badge label={STEMS_BADGE} />
          {now ? <NowBadge /> : null}
        </View>
      }
      accessibilityLabel={now ? `${spoken}, now loaded` : spoken}
      onPress={open}
      onLongPress={actions}
      onActions={actions}
    />
  );
}

function EntryRow(props: EntryRowProps) {
  const { item, preset } = props.entry;
  const now = useLibrary((s) => s.loaded?.itemId === item.id);
  const { drag, load, actions } = useEntryRow(props);
  const custom = useCustomSoundViews();
  const subtitle = songSubtitle(preset, custom);
  const spoken = `${String(props.index + 1)}. ${preset.name}, ${subtitle}`;
  return (
    <DragListRow
      title={preset.name}
      subtitle={subtitle}
      active={now}
      menuOpen={isSongTarget(props.songMenu, { preset, itemId: item.id })}
      reorder={drag}
      trailing={now ? <NowBadge /> : undefined}
      accessibilityLabel={now ? `${spoken}, now loaded` : spoken}
      onPress={load}
      onLongPress={actions}
      onActions={actions}
    />
  );
}

interface SectionProps {
  readonly setlistId: number;
  readonly onLoaded: () => void;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly entries: readonly SetlistEntry[];
  readonly menu: DetailMenu;
}

function useOpenStemEntry({ setlistId, onOpenStemSet }: SectionProps) {
  const openStemEntry = useLibrary((s) => s.openStemEntry);
  const openStemPlayer = useOpenStemPlayer(onOpenStemSet);
  return useCallback(
    (entry: StemSetlistEntry) => {
      void openStemEntry(entry.item.id, setlistId).then((opened) => {
        if (opened) openStemPlayer(entry.stemSetId);
      });
    },
    [openStemEntry, setlistId, openStemPlayer],
  );
}

function usePlayFromOne(props: SectionProps) {
  const { setlistId, onLoaded, entries } = props;
  const loadSong = useLibrary((s) => s.loadSong);
  const start = useMetronome((s) => s.start);
  const openStem = useOpenStemEntry(props);
  const [first] = entries;
  return useCallback(() => {
    if (first === undefined) return;
    if (!isPresetEntry(first)) {
      openStem(first);
      return;
    }
    void loadSong(first.preset.id, first.item.id, setlistId).then(() => {
      start();
      onLoaded();
    });
  }, [first, loadSong, setlistId, onLoaded, start, openStem]);
}

function DetailChips(props: SectionProps) {
  const playFromOne = usePlayFromOne(props);
  const { entries, menu } = props;
  const loadedHere = useLibrary((s) =>
    entries.some((e) => e.item.id === s.loaded?.itemId),
  );
  return (
    <ChipRow>
      {entries.length === 0 ? null : (
        <Chip active icon="play" label="Play from 1" onPress={playFromOne} />
      )}
      <Chip icon="add" label="Add song" onPress={menu.openAdd} />
      {loadedHere ? (
        <Chip icon="saveInto" label="Save current" onPress={menu.openSave} />
      ) : null}
    </ChipRow>
  );
}

function EmptySet({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <EmptyState
      icon="song"
      title="No songs in this set"
      reason="Add a metronome song or a stem song, or save what the metronome is playing now."
      action={{ label: 'Add song', onPress: onAdd }}
    />
  );
}

interface StemActionsTarget {
  readonly itemId: number;
  readonly name: string;
}

function useStemActions() {
  const [target, setTarget] = useState<StemActionsTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = useCallback((entry: StemSetlistEntry, name: string) => {
    setError(null);
    setTarget({ itemId: entry.item.id, name });
  }, []);
  const close = useCallback(() => {
    setTarget(null);
  }, []);
  return { target, error, setError, open, close };
}

type StemActions = ReturnType<typeof useStemActions>;

function StemActionsSheet({
  actions,
  bottomInset,
}: {
  readonly actions: StemActions;
  readonly bottomInset: number;
}) {
  const removeFromSet = useLibrary((s) => s.removeFromSet);
  const { target, close, setError } = actions;
  const remove = useCallback(
    () =>
      guarded(setError, CHANGE_NOT_SAVED, async () => {
        if (target !== null) await removeFromSet(target.itemId);
        close();
      }),
    [setError, target, removeFromSet, close],
  );
  return (
    <ActionsSheet
      visible={target !== null}
      title={target?.name ?? ''}
      bottomInset={bottomInset}
      onDismiss={close}
      error={actions.error}
      actions={[{ label: REMOVE_FROM_SET, onPress: remove }]}
    />
  );
}

interface EntryListProps extends SectionProps {
  readonly songMenu: SongMenu;
  readonly stemTarget: StemActionsTarget | null;
  readonly onStemActions: StemActions['open'];
}

function EntryList(props: EntryListProps) {
  const ready = useLibrary((s) => s.ready);
  const openStem = useOpenStemEntry(props);
  const { entries } = props;
  if (ready && entries.length === 0)
    return <EmptySet onAdd={props.menu.openAdd} />;
  const shared = { count: entries.length, setlistId: props.setlistId };
  return entries.map((entry, index) =>
    isPresetEntry(entry) ? (
      <EntryRow
        key={entry.item.id}
        {...shared}
        entry={entry}
        index={index}
        songMenu={props.songMenu}
        onLoaded={props.onLoaded}
      />
    ) : (
      <StemEntryRow
        key={entry.item.id}
        {...shared}
        entry={entry}
        index={index}
        menuOpen={props.stemTarget?.itemId === entry.item.id}
        onOpen={openStem}
        onActions={props.onStemActions}
      />
    ),
  );
}

function ReorderHint() {
  return (
    <Card>
      <SheetHint>Tap a song to load it · drag the handle to reorder</SheetHint>
    </Card>
  );
}

function MissingSet(props: SetlistDetailScreenProps) {
  return (
    <ScreenFrame
      insets={props.insets}
      header={<AppBar title="Setlist not found" onBack={props.onBack} />}
    >
      <EmptyState
        icon="songs"
        title="Setlist not found"
        reason="This setlist may have been deleted from another screen."
        action={{ label: 'Go back', onPress: props.onBack }}
      />
    </ScreenFrame>
  );
}

export function SetlistDetailScreen(props: SetlistDetailScreenProps) {
  useLibraryRefresh();
  const { setlistId, insets, onEditPreset } = props;
  const entries = useLibrary((s) => s.entries[setlistId] ?? NO_ENTRIES);
  const summary = useLibrary((s) =>
    s.setlists.find((x) => x.setlist.id === setlistId),
  );
  const ready = useLibrary((s) => s.ready);
  const name = setlistTitle(summary?.setlist.name);
  const songMenu = useSongMenu();
  const menu = useDetailMenu();
  const stemActions = useStemActions();
  if (ready && summary === undefined) return <MissingSet {...props} />;
  const section = {
    setlistId,
    onLoaded: props.onLoaded,
    onOpenStemSet: props.onOpenStemSet,
    entries,
    menu,
  };
  const sheets = {
    setlistId,
    bottomInset: insets.bottom,
    onEdit: onEditPreset,
  };
  return (
    <ScreenFrame
      insets={insets}
      header={<AppBar title={name} onBack={props.onBack} />}
      footer={entries.length === 0 ? null : <ReorderHint />}
    >
      <DetailChips {...section} />
      <EntryList
        {...section}
        songMenu={songMenu}
        stemTarget={stemActions.target}
        onStemActions={stemActions.open}
      />
      <SongMenuSheets {...sheets} menu={songMenu} />
      <StemActionsSheet actions={stemActions} bottomInset={insets.bottom} />
      <DetailSheets
        {...sheets}
        menu={menu}
        entries={entries}
        onAddStemSongs={props.onAddStemSongs}
      />
    </ScreenFrame>
  );
}
