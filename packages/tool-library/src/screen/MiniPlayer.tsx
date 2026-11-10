import { MiniPlayerBar } from '@kitbag/core-design';
import {
  loopEndFrames,
  useSongPlayer,
  type SongPlayerStore,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import { miniPlayerDetail } from '../logic/miniPlayerDetail.ts';
import type { UsePlayhead } from './playhead.ts';

export interface MiniPlayerProps {
  readonly usePlayhead: UsePlayhead;
  readonly bottomInset: number;
  readonly onOpenSong: (id: number) => void;
}

const miniPlayerShown = (s: SongPlayerStore) => s.status === 'ready';

interface LiveProps extends MiniPlayerProps {
  readonly songId: number;
}

function LiveMiniPlayer({
  songId,
  usePlayhead,
  bottomInset,
  onOpenSong,
}: LiveProps) {
  const title = useSongPlayer((s) => s.title);
  const artist = useSongPlayer((s) => s.artist);
  const click = useSongPlayer((s) => s.click);
  const rate = useSongPlayer((s) => s.engineRate);
  const frames = useSongPlayer((s) => s.durationFrames);
  const loopEnd = useSongPlayer(loopEndFrames);
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const close = useSongPlayer((s) => s.close);
  const { progress, playing } = usePlayhead(rate, frames, loopEnd);
  const open = useCallback(() => {
    onOpenSong(songId);
  }, [onOpenSong, songId]);
  return (
    <MiniPlayerBar
      title={title}
      detail={miniPlayerDetail(artist, click)}
      progress={progress}
      playing={playing}
      openLabel={`Open ${title}`}
      playLabel={`Play ${title}`}
      pauseLabel={`Pause ${title}`}
      closeLabel={`Stop ${title}`}
      bottomInset={bottomInset}
      onOpen={open}
      onTogglePlay={togglePlay}
      onClose={close}
    />
  );
}

export function MiniPlayer(props: MiniPlayerProps) {
  const songId = useSongPlayer((s) => (miniPlayerShown(s) ? s.songId : null));
  if (songId === null) return null;
  return <LiveMiniPlayer songId={songId} {...props} />;
}
