import {
  AppBar,
  Badge,
  Chip,
  ChipRow,
  EmptyState,
  SongRow,
} from '@kitbag/core-design';
import { useLibrary, type SongPreset } from '@kitbag/core-state';
import { useCallback } from 'react';

import { songSubtitle } from '../logic/songSummary.ts';
import type { ShellMeasuredInsets } from '../screen/MetronomeScreen.tsx';
import { NEW_SONG_NAME } from './DetailMenu.tsx';
import { ScreenFrame } from './ScreenFrame.tsx';
import { SongMenuSheets, useSongMenu, type SongMenu } from './SongMenu.tsx';
import { useLibraryRefresh } from './useLibraryRefresh.ts';

export interface AllSongsScreenProps {
  readonly insets: ShellMeasuredInsets;
  readonly onBack: () => void;
  readonly onEditPreset: (presetId: number) => void;
  readonly onLoaded: () => void;
}

interface RowProps {
  readonly preset: SongPreset;
  readonly menu: SongMenu;
  readonly onLoaded: () => void;
}

function useStandaloneRow({ preset, menu, onLoaded }: RowProps) {
  const loadSong = useLibrary((s) => s.loadSong);
  const load = useCallback(() => {
    void loadSong(preset.id).then(onLoaded);
  }, [loadSong, preset.id, onLoaded]);
  const actions = useCallback(() => {
    menu.openActions({ preset, itemId: null });
  }, [menu, preset]);
  return { load, actions };
}

function StandaloneRow(props: RowProps) {
  const { preset } = props;
  const now = useLibrary(
    (s) => s.loaded?.presetId === preset.id && s.loaded.itemId === null,
  );
  const { load, actions } = useStandaloneRow(props);
  const subtitle = songSubtitle(preset);
  return (
    <SongRow
      title={preset.name}
      subtitle={subtitle}
      active={now}
      trailing={now ? <Badge tone="accent" label="NOW" /> : undefined}
      accessibilityLabel={`${preset.name}, ${subtitle}${now ? ', now loaded' : ''}`}
      onPress={load}
      onLongPress={actions}
    />
  );
}

function NoStandalone({ onCreate }: { readonly onCreate: () => void }) {
  return (
    <EmptyState
      icon="song"
      title="Every song is in a setlist"
      reason="Songs you remove from a set, or save here, wait in this list."
      actionLabel="New song from the metronome"
      onAction={onCreate}
    />
  );
}

function StandaloneList(
  props: AllSongsScreenProps & {
    readonly menu: SongMenu;
    readonly onCreate: () => void;
  },
) {
  const standalone = useLibrary((s) => s.standalone);
  const ready = useLibrary((s) => s.ready);
  if (ready && standalone.length === 0)
    return <NoStandalone onCreate={props.onCreate} />;
  return standalone.map((preset) => (
    <StandaloneRow
      key={preset.id}
      preset={preset}
      menu={props.menu}
      onLoaded={props.onLoaded}
    />
  ));
}

export function AllSongsScreen(props: AllSongsScreenProps) {
  useLibraryRefresh();
  const newSong = useLibrary((s) => s.newSongFromCurrent);
  const menu = useSongMenu();
  const { onEditPreset, insets } = props;
  const create = useCallback(() => {
    void newSong(NEW_SONG_NAME).then(onEditPreset);
  }, [newSong, onEditPreset]);
  return (
    <ScreenFrame
      insets={insets}
      header={<AppBar title="All songs" onBack={props.onBack} />}
    >
      <ChipRow>
        <Chip icon="add" label="New song" onPress={create} />
      </ChipRow>
      <StandaloneList {...props} menu={menu} onCreate={create} />
      <SongMenuSheets
        menu={menu}
        setlistId={null}
        bottomInset={insets.bottom}
        onEdit={onEditPreset}
      />
    </ScreenFrame>
  );
}
