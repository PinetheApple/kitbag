import { MiniPlayerBar } from '@kitbag/core-design';
import type { PlayAlongLock } from '@kitbag/core-state';

import {
  lockedSubtext,
  lockedTitle,
  lockedToLine,
  PLAY_ALONG_NAME,
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

function useLockedAppLabel(): string | undefined {
  const locked = usePlayAlong((s) => s.lock !== undefined);
  const appLabel = useLastSeen(useFollowedSession()?.appLabel);
  return locked ? appLabel : undefined;
}

export function useLockedSubtext(): string | undefined {
  const appLabel = useLockedAppLabel();
  return appLabel === undefined ? undefined : lockedSubtext(appLabel);
}

interface LockedProps extends PlayAlongMiniPlayerProps {
  readonly lock: PlayAlongLock;
}

function LockedMiniPlayer({ lock, bottomInset, onOpen }: LockedProps) {
  const session = useFollowedSession();
  const appLabel = useLockedAppLabel();
  const progress = usePlayAlongProgress(session);
  const playing = usePlayingValue(session?.playing === true);
  const playPause = usePlayAlong((s) => s.playPause);
  const unlock = usePlayAlong((s) => s.unlock);
  const title = lockedTitle(lock.track);
  return (
    <MiniPlayerBar
      tile="playAlong"
      title={title}
      detail={lockedToLine(appLabel)}
      progress={progress}
      playing={playing}
      openLabel={`Open ${PLAY_ALONG_NAME}`}
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
  return lock === undefined ? null : <LockedMiniPlayer lock={lock} {...props} />;
}
