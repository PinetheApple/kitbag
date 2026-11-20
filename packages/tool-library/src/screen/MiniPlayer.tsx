import {
  MiniPlayerBar,
  queueKeyLabel,
  type MiniPlayerTile,
} from '@kitbag/core-design';
import {
  loopEndFrames,
  songShown,
  stemShown,
  stemSongTitle,
  stopSongAndSession,
  upNextTitle,
  useLibrarySongs,
  useSetlistSpot,
  useShownSongId,
  useShownStemSetId,
  useSongPlayer,
  useStemPlayer,
  useStemSongs,
  useUpNext,
  useUpNextCount,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import {
  miniPlayerDetail,
  stemMiniPlayerDetail,
} from '../logic/miniPlayerDetail.ts';
import type { UsePlayhead } from './playhead.ts';

export interface MiniPlayerProps {
  readonly usePlayhead: UsePlayhead;
  readonly bottomInset: number;
  readonly onOpenSong: (id: number) => void;
  readonly onOpenStemSet: (id: number) => void;
  readonly onOpenQueue: () => void;
}

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

type BarProps = Pick<
  MiniPlayerProps,
  'usePlayhead' | 'bottomInset' | 'onOpenQueue'
>;

function LiveMiniPlayer({
  shown,
  usePlayhead,
  bottomInset,
  onOpenQueue,
}: BarProps & { readonly shown: ShownSong }) {
  const { title, engineRate, durationFrames, loopEnd } = shown;
  const { progress, playing } = usePlayhead(
    engineRate,
    durationFrames,
    loopEnd,
  );
  const upNextCount = useUpNextCount();
  const stop = useCallback(() => {
    stopSongAndSession();
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
      queueLabel={queueKeyLabel(upNextCount)}
      bottomInset={bottomInset}
      onOpen={shown.onOpen}
      onQueue={onOpenQueue}
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

function useNextTitle(): string | null {
  const next = useUpNext();
  const library = useLibrarySongs();
  return next === undefined ? null : upNextTitle(next, library);
}

function useStemTitle(setId: number): string {
  const title = useStemPlayer((s) => s.title);
  const loading = useStemPlayer((s) => s.status === 'loading');
  const stems = useStemSongs();
  return loading ? stemSongTitle(setId, stems) : title;
}

interface StemProps extends BarProps {
  readonly setId: number;
  readonly onOpenStemSet: (id: number) => void;
}

function StemMiniPlayer({ setId, onOpenStemSet, ...bar }: StemProps) {
  const title = useStemTitle(setId);
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
  const songId = useShownSongId();
  const setId = useShownStemSetId();
  if (songId !== null)
    return <SongMiniPlayer songId={songId} onOpenSong={onOpenSong} {...bar} />;
  if (setId === null) return null;
  return (
    <StemMiniPlayer setId={setId} onOpenStemSet={onOpenStemSet} {...bar} />
  );
}
