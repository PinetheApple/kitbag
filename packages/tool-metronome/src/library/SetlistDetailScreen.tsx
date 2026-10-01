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
  useLibrary,
  useMetronome,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { songSubtitle } from '../logic/songSummary.ts';
import type { ShellMeasuredInsets } from '../screen/MetronomeScreen.tsx';
import { DetailSheets, useDetailMenu, type DetailMenu } from './DetailMenu.tsx';
import { ScreenFrame } from './ScreenFrame.tsx';
import { SongMenuSheets, useSongMenu, type SongMenu } from './SongMenu.tsx';
import { useLibraryRefresh } from './useLibraryRefresh.ts';

const NO_ENTRIES: readonly SetlistEntry[] = [];

export interface SetlistDetailScreenProps {
  readonly setlistId: number;
  readonly insets: ShellMeasuredInsets;
  readonly onBack: () => void;
  readonly onEditPreset: (presetId: number) => void;
  readonly onLoaded: () => void;
}

interface EntryRowProps {
  readonly entry: SetlistEntry;
  readonly index: number;
  readonly count: number;
  readonly setlistId: number;
  readonly songMenu: SongMenu;
  readonly onLoaded: () => void;
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
  const reorder = useLibrary((s) => s.reorder);
  const onMove = useCallback(
    (from: number, to: number) => {
      void reorder(setlistId, from, to);
    },
    [reorder, setlistId],
  );
  const drag = useMemo(
    () => ({ index, count, onMove }),
    [index, count, onMove],
  );
  const load = useCallback(() => {
    void loadSong(preset.id, item.id, setlistId).then(onLoaded);
  }, [loadSong, preset.id, item.id, setlistId, onLoaded]);
  const actions = useCallback(() => {
    songMenu.openActions({ preset, itemId: item.id });
  }, [songMenu, preset, item.id]);
  return { drag, load, actions };
}

function EntryRow(props: EntryRowProps) {
  const { item, preset } = props.entry;
  const now = useLibrary((s) => s.loaded?.itemId === item.id);
  const { drag, load, actions } = useEntryRow(props);
  const subtitle = songSubtitle(preset);
  const spoken = `${String(props.index + 1)}. ${preset.name}, ${subtitle}`;
  return (
    <DragListRow
      title={preset.name}
      subtitle={subtitle}
      active={now}
      reorder={drag}
      trailing={now ? <Badge tone="accent" label="NOW" /> : undefined}
      accessibilityLabel={now ? `${spoken}, now loaded` : spoken}
      onPress={load}
      onLongPress={actions}
    />
  );
}

interface SectionProps {
  readonly setlistId: number;
  readonly onLoaded: () => void;
  readonly entries: readonly SetlistEntry[];
  readonly menu: DetailMenu;
}

function usePlayFromOne({ setlistId, onLoaded, entries }: SectionProps) {
  const loadSong = useLibrary((s) => s.loadSong);
  const start = useMetronome((s) => s.start);
  const first = entries[0];
  return useCallback(() => {
    if (first === undefined) return;
    void loadSong(first.preset.id, first.item.id, setlistId).then(() => {
      start();
      onLoaded();
    });
  }, [first, loadSong, setlistId, onLoaded, start]);
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
      reason="Add a song you already have, or save what the metronome is playing now."
      actionLabel="Add song"
      onAction={onAdd}
    />
  );
}

function EntryList(props: SectionProps & { readonly songMenu: SongMenu }) {
  const ready = useLibrary((s) => s.ready);
  const { entries } = props;
  if (ready && entries.length === 0)
    return <EmptySet onAdd={props.menu.openAdd} />;
  return entries.map((entry, index) => (
    <EntryRow
      key={entry.item.id}
      entry={entry}
      index={index}
      count={entries.length}
      setlistId={props.setlistId}
      songMenu={props.songMenu}
      onLoaded={props.onLoaded}
    />
  ));
}

function ReorderHint() {
  return (
    <Card>
      <SheetHint>Tap a song to load it · drag ≡ to reorder</SheetHint>
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
        actionLabel="Go back"
        onAction={props.onBack}
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
  const name = summary?.setlist.name ?? '';
  const songMenu = useSongMenu();
  const menu = useDetailMenu();
  if (ready && summary === undefined) return <MissingSet {...props} />;
  const section = { setlistId, onLoaded: props.onLoaded, entries, menu };
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
      <EntryList {...section} songMenu={songMenu} />
      <SongMenuSheets {...sheets} menu={songMenu} />
      <DetailSheets {...sheets} menu={menu} entries={entries} />
    </ScreenFrame>
  );
}
