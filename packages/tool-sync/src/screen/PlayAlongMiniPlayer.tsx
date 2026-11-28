import { MiniPlayerBar } from '@kitbag/core-design';
import type { PlayAlongLock } from '@kitbag/core-state';

import { manifest } from '../manifest.ts';
import {
  lockedSubtext,
  lockedTitle,
  lockedToLine,
} from '../logic/miniPlayer.ts';
import { useFollowedSession, usePlayAlong } from './playAlongHooks.ts';
import { useLastSeen } from './useLastSeen.ts';
import { usePlayAlongProgress } from './usePlayAlongProgress.ts';
import { usePlayingValue } from './usePlayingValue.ts';

export interface PlayAlongMiniPlayerProps {
  readonly bottomInset: number;
  readonly onOpen: () => void;
}

export function usePlayAlongMiniShown(): boolean {
  return usePlayAlong((s) => s.lock !== undefined);
}

export function useLockedSubtext(): string | undefined {
  const locked = usePlayAlong((s) => s.lock !== undefined);
  const appLabel = useLastSeen(useFollowedSession()?.appLabel);
  return locked ? lockedSubtext(appLabel) : undefined;
}

interface LockedProps extends PlayAlongMiniPlayerProps {
  readonly lock: PlayAlongLock;
}

function LockedMiniPlayer({ lock, bottomInset, onOpen }: LockedProps) {
  const session = useFollowedSession();
  const lastSeen = useLastSeen(session);
  const progress = usePlayAlongProgress(lastSeen);
  const playing = usePlayingValue(session?.playing === true);
  const playPause = usePlayAlong((s) => s.playPause);
  const unlock = usePlayAlong((s) => s.unlock);
  const title = lockedTitle(lock.track);
  return (
    <MiniPlayerBar
      tile="playAlong"
      title={title}
      detail={lockedToLine(lastSeen?.appLabel)}
      progress={progress}
      playing={playing}
      openLabel={`Open ${manifest.name}`}
      playLabel={`Play ${title}`}
      pauseLabel={`Pause ${title}`}
      closeLabel={`Stop following ${title}`}
      bottomInset={bottomInset}
      onOpen={onOpen}
      onTogglePlay={playPause}
      onClose={unlock}
    />
  );
}

export function PlayAlongMiniPlayer(props: PlayAlongMiniPlayerProps) {
  const lock = usePlayAlong((s) => s.lock);
  return lock === undefined ? null : (
    <LockedMiniPlayer lock={lock} {...props} />
  );
}
