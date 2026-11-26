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
  useLiveSongPlayer,
  useLiveStemPlayer,
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
  const song = useLiveSongPlayer(songShown);
  const stem = useLiveStemPlayer(stemShown);
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
  const title = useLiveSongPlayer((s) => s.title);
  const artist = useLiveSongPlayer((s) => s.artist);
  const click = useLiveSongPlayer((s) => s.click);
  const speed = useLiveSongPlayer((s) => s.speed);
  const engineRate = useLiveSongPlayer((s) => s.engineRate);
  const durationFrames = useLiveSongPlayer((s) => s.durationFrames);
  const loopEnd = useLiveSongPlayer(loopEndFrames);
  const onTogglePlay = useLiveSongPlayer((s) => s.togglePlay);
  const { songs } = useLibrarySongs();
  const onOpen = useCallback(() => {
    if (songs.has(songId)) onOpenSong(songId);
  }, [onOpenSong, songId, songs]);
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
  const title = useLiveStemPlayer((s) => s.title);
  const loading = useLiveStemPlayer((s) => s.status === 'loading');
  const stems = useStemSongs();
  return loading ? stemSongTitle(setId, stems) : title;
}

interface StemProps extends BarProps {
  readonly setId: number;
  readonly onOpenStemSet: (id: number) => void;
}

function StemMiniPlayer({ setId, onOpenStemSet, ...bar }: StemProps) {
  const title = useStemTitle(setId);
  const artist = useLiveStemPlayer((s) => s.artist);
  const engineRate = useLiveStemPlayer((s) => s.engineRate);
  const durationFrames = useLiveStemPlayer((s) => s.durationFrames);
  const loopEnd = useLiveStemPlayer(loopEndFrames);
  const onTogglePlay = useLiveStemPlayer((s) => s.togglePlay);
  const spot = useSetlistSpot(setId);
  const next = useNextTitle();
  const { stems } = useLibrarySongs();
  const onOpen = useCallback(() => {
    if (stems.has(setId)) onOpenStemSet(setId);
  }, [onOpenStemSet, setId, stems]);
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
