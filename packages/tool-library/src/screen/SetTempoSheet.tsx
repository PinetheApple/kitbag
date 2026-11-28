import {
  SetTempoSheet as SharedSetTempoSheet,
  type SetTempo,
} from '@kitbag/core-design';
import {
  useLiveSongPlayer,
  useLoopScrub,
  useSongPlayer,
  type GridMeter,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import type { SongPlayhead } from './playhead.ts';

export interface SetTempoSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playhead: SongPlayhead;
  readonly tempo: SetTempo<GridMeter>;
  readonly onClose: () => void;
}

export function SetTempoSheet(props: SetTempoSheetProps) {
  const togglePlay = useSongPlayer((s) => s.togglePlay);
  const scrub = useLoopScrub(useSongPlayer);
  const click = useSongPlayer((s) => s.click);
  const toggleClick = useLiveSongPlayer((s) => s.toggleClick);
  const onToggle = useCallback(() => {
    void toggleClick();
  }, [toggleClick]);
  const transport = useMemo(
    () => ({ onTogglePlay: togglePlay, scrub }),
    [togglePlay, scrub],
  );
  const previewClick = useMemo(
    () => ({ on: click, onToggle }),
    [click, onToggle],
  );
  return (
    <SharedSetTempoSheet
      {...props}
      transport={transport}
      previewClick={previewClick}
    />
  );
}
