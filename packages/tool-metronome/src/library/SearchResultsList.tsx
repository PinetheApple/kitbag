import { EmptyState, ListRow, SongRow } from '@kitbag/core-design';
import { useLibrary, type Setlist, type SongPreset } from '@kitbag/core-state';
import { useCallback } from 'react';

import { songSubtitle } from '../logic/songSummary.ts';

function SetlistResult({
  setlist,
  onOpen,
}: {
  readonly setlist: Setlist;
  readonly onOpen: (id: number) => void;
}) {
  const open = useCallback(() => {
    onOpen(setlist.id);
  }, [onOpen, setlist.id]);
  return (
    <ListRow
      icon="songs"
      title={setlist.name}
      subtitle="Setlist"
      onPress={open}
    />
  );
}

function SongResult({
  preset,
  onLoaded,
}: {
  readonly preset: SongPreset;
  readonly onLoaded: () => void;
}) {
  const loadSong = useLibrary((s) => s.loadSong);
  const load = useCallback(() => {
    void loadSong(preset.id).then(onLoaded);
  }, [loadSong, preset.id, onLoaded]);
  const subtitle = songSubtitle(preset);
  return (
    <SongRow
      title={preset.name}
      subtitle={subtitle}
      accessibilityLabel={`${preset.name}, ${subtitle}. Load`}
      onPress={load}
    />
  );
}

export interface SearchResultsListProps {
  readonly query: string;
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
        actionLabel="Clear search"
        onAction={props.onClear}
      />
    );
  }
  return (
    <>
      {results.setlists.map((setlist) => (
        <SetlistResult
          key={`s${String(setlist.id)}`}
          setlist={setlist}
          onOpen={props.onOpenSetlist}
        />
      ))}
      {results.presets.map((preset) => (
        <SongResult
          key={`p${String(preset.id)}`}
          preset={preset}
          onLoaded={props.onLoaded}
        />
      ))}
    </>
  );
}
