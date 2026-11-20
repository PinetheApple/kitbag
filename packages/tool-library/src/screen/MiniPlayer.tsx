import { MiniPlayerBar, type MiniPlayerTile } from '@kitbag/core-design';
import {
  entryName,
  loopEndFrames,
  stemSongTitle,
  stopListening,
  UP_NEXT_SOURCE,
  useLibrary,
  useSongPlayer,
  useStage,
  useStemPlayer,
  useStemSongs,
  useUpNext,
  type SongPlayerStore,
  type StemPlayerStore,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import {
  miniPlayerDetail,
  stemMiniPlayerDetail,
  type SetlistSpot,
} from '../logic/miniPlayerDetail.ts';
import type { UsePlayhead } from './playhead.ts';

export interface MiniPlayerProps {
  readonly usePlayhead: UsePlayhead;
  readonly bottomInset: number;
  readonly onOpenSong: (id: number) => void;
  readonly onOpenStemSet: (id: number) => void;
}

const songShown = (s: SongPlayerStore) => s.status === 'ready';
const stemShown = (s: StemPlayerStore) => s.status === 'ready';

export function useMiniPlayerShown(): boolean {
  const song = useSongPlayer(songShown);
  const stem = useStemPlayer(stemShown);
  return song || stem;
}

interface ShownSong {
  readonly tile: MiniPlayerTile;
  readonly title: string;
  readonly detail: string;
  readonly engineRate: number;
  readonly durationFrames: number;
  readonly loopEnd: number | null;
  readonly onTogglePlay: () => void;
  readonly onOpen: () => void;
}

type BarProps = Pick<MiniPlayerProps, 'usePlayhead' | 'bottomInset'>;

function LiveMiniPlayer({
  shown,
  usePlayhead,
  bottomInset,
}: BarProps & { readonly shown: ShownSong }) {
  const { title, engineRate, durationFrames, loopEnd } = shown;
  const { progress, playing } = usePlayhead(
    engineRate,
    durationFrames,
    loopEnd,
  );
  const stop = useCallback(() => {
    stopListening();
  }, []);
  return (
    <MiniPlayerBar
      tile={shown.tile}
      title={title}
      detail={shown.detail}
      progress={progress}
      playing={playing}
      openLabel={`Open ${title}`}
      playLabel={`Play ${title}`}
      pauseLabel={`Pause ${title}`}
      closeLabel={`Stop ${title}`}
      bottomInset={bottomInset}
      onOpen={shown.onOpen}
      onTogglePlay={shown.onTogglePlay}
      onClose={stop}
    />
  );
}

interface SongProps extends BarProps {
  readonly songId: number;
  readonly onOpenSong: (id: number) => void;
}

function SongMiniPlayer({ songId, onOpenSong, ...bar }: SongProps) {
  const title = useSongPlayer((s) => s.title);
  const artist = useSongPlayer((s) => s.artist);
  const click = useSongPlayer((s) => s.click);
  const speed = useSongPlayer((s) => s.speed);
  const engineRate = useSongPlayer((s) => s.engineRate);
  const durationFrames = useSongPlayer((s) => s.durationFrames);
  const loopEnd = useSongPlayer(loopEndFrames);
  const onTogglePlay = useSongPlayer((s) => s.togglePlay);
  const onOpen = useCallback(() => {
    onOpenSong(songId);
  }, [onOpenSong, songId]);
  const shown: ShownSong = {
    tile: 'song',
    title,
    detail: miniPlayerDetail(artist, click, speed),
    engineRate,
    durationFrames,
    loopEnd,
    onTogglePlay,
    onOpen,
  };
  return <LiveMiniPlayer shown={shown} {...bar} />;
}

function useSetlistSpot(setId: number): SetlistSpot | null {
  const loaded = useLibrary((s) => s.loaded);
  const { stage, cursor, name } = useStage();
  if (cursor === null || loaded?.presetId !== null) return null;
  if (loaded.stemSetId !== setId) return null;
  return {
    setlistName: name,
    number: cursor.index + 1,
    of: stage.entries.length,
  };
}

function useNextTitle(): string | null {
  const next = useUpNext();
  const stems = useStemSongs();
  if (next === undefined) return null;
  return next.source === UP_NEXT_SOURCE.queue
    ? stemSongTitle(next.stemSetId, stems)
    : entryName(next.entry, stems);
}

interface StemProps extends BarProps {
  readonly setId: number;
  readonly onOpenStemSet: (id: number) => void;
}

function StemMiniPlayer({ setId, onOpenStemSet, ...bar }: StemProps) {
  const title = useStemPlayer((s) => s.title);
  const artist = useStemPlayer((s) => s.artist);
  const engineRate = useStemPlayer((s) => s.engineRate);
  const durationFrames = useStemPlayer((s) => s.durationFrames);
  const loopEnd = useStemPlayer(loopEndFrames);
  const onTogglePlay = useStemPlayer((s) => s.togglePlay);
  const spot = useSetlistSpot(setId);
  const next = useNextTitle();
  const onOpen = useCallback(() => {
    onOpenStemSet(setId);
  }, [onOpenStemSet, setId]);
  const shown: ShownSong = {
    tile: 'stems',
    title,
    detail: stemMiniPlayerDetail(artist, spot, next),
    engineRate,
    durationFrames,
    loopEnd,
    onTogglePlay,
    onOpen,
  };
  return <LiveMiniPlayer shown={shown} {...bar} />;
}

export function MiniPlayer({
  onOpenSong,
  onOpenStemSet,
  ...bar
}: MiniPlayerProps) {
  const songId = useSongPlayer((s) => (songShown(s) ? s.songId : null));
  const setId = useStemPlayer((s) => (stemShown(s) ? s.setId : null));
  if (songId !== null)
    return <SongMiniPlayer songId={songId} onOpenSong={onOpenSong} {...bar} />;
  if (setId === null) return null;
  return (
    <StemMiniPlayer setId={setId} onOpenStemSet={onOpenStemSet} {...bar} />
  );
}
