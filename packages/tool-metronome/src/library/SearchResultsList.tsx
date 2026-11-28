import { EmptyState, ListRow, PlainListRow } from '@kitbag/core-design';
import { useLibrary, type Setlist, type SongPreset } from '@kitbag/core-state';
import { useCallback } from 'react';

import { songSubtitle } from '../logic/songSummary.ts';
import { useCustomSoundViews } from '../screen/CustomSounds.tsx';
import { isSetlistTarget, type SetlistsMenu } from './SetlistsMenu.tsx';
import { isSongTarget, type SongMenu } from './SongMenu.tsx';

function SetlistResult({
  setlist,
  menu,
  onOpen,
}: {
  readonly setlist: Setlist;
  readonly menu: SetlistsMenu;
  readonly onOpen: (id: number) => void;
}) {
  const open = useCallback(() => {
    onOpen(setlist.id);
  }, [onOpen, setlist.id]);
  const actions = useCallback(() => {
    menu.openActions(setlist.id);
  }, [menu, setlist.id]);
  return (
    <ListRow
      icon="songs"
      title={setlist.name}
      subtitle="Setlist"
      menuOpen={isSetlistTarget(menu, setlist.id)}
      onPress={open}
      onLongPress={actions}
      onActions={actions}
    />
  );
}

function SongResult({
  preset,
  songMenu,
  onLoaded,
}: {
  readonly preset: SongPreset;
  readonly songMenu: SongMenu;
  readonly onLoaded: () => void;
}) {
  const loadSong = useLibrary((s) => s.loadSong);
  const load = useCallback(() => {
    void loadSong(preset.id).then(onLoaded);
  }, [loadSong, preset.id, onLoaded]);
  const actions = useCallback(() => {
    songMenu.openActions({ preset, itemId: null });
  }, [songMenu, preset]);
  const custom = useCustomSoundViews();
  const subtitle = songSubtitle(preset, custom);
  return (
    <PlainListRow
      title={preset.name}
      subtitle={subtitle}
      menuOpen={isSongTarget(songMenu, { preset, itemId: null })}
      accessibilityLabel={`${preset.name}, ${subtitle}. Load`}
      onPress={load}
      onLongPress={actions}
      onActions={actions}
    />
  );
}

export interface SearchResultsListProps {
  readonly query: string;
  readonly menu: SetlistsMenu;
  readonly songMenu: SongMenu;
  readonly onClear: () => void;
  readonly onOpenSetlist: (id: number) => void;
  readonly onLoaded: () => void;
}

export function SearchResultsList(props: SearchResultsListProps) {
  const results = useLibrary((s) => s.results);
  if (results === null) return null;
  if (results.setlists.length === 0 && results.presets.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No matches"
        reason={`No setlist or song contains “${props.query}”.`}
        action={{ label: 'Clear search', onPress: props.onClear }}
      />
    );
  }
  return (
    <>
      {results.setlists.map((setlist) => (
        <SetlistResult
          key={`s${String(setlist.id)}`}
          setlist={setlist}
          menu={props.menu}
          onOpen={props.onOpenSetlist}
        />
      ))}
      {results.presets.map((preset) => (
        <SongResult
          key={`p${String(preset.id)}`}
          preset={preset}
          songMenu={props.songMenu}
          onLoaded={props.onLoaded}
        />
      ))}
    </>
  );
}
