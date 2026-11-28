import {
  useSetTempo as useSharedSetTempo,
  useTempoPreview as useSharedTempoPreview,
  type SetTempo,
  type SetTempoCallbacks,
} from '@kitbag/core-design';
import {
  framesToSeconds,
  useLiveSongPlayer,
  useSongPlayer,
  type GridMeter,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { SONG_SET_TEMPO } from '../logic/manualTempoText.ts';
import { useSongKeyed } from './useSongKeyed.ts';

function useSongTempoPlayer() {
  const manualTempo = useSongPlayer((s) => s.manualTempo);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  const detected = useSongPlayer((s) => s.detected);
  const override = useSongPlayer((s) => s.meterOverride);
  const durationSec = useSongPlayer((s) =>
    framesToSeconds(s.durationFrames, s.engineRate),
  );
  const playheadSeconds = useLiveSongPlayer((s) => s.playheadSeconds);
  const setManualTempo = useLiveSongPlayer((s) => s.setManualTempo);
  const previewTempo = useLiveSongPlayer((s) => s.previewTempo);
  return useMemo(
    () => ({
      seed: {
        manualTempo,
        analysedBpm,
        barOneSeconds: override.barOneSeconds ?? detected.barOneSeconds,
        meter: override.meterBeatsPerBar ?? detected.meter,
      },
      durationSec,
      playheadSeconds,
      setManualTempo,
      previewTempo,
    }),
    [
      manualTempo,
      analysedBpm,
      detected,
      override,
      durationSec,
      playheadSeconds,
      setManualTempo,
      previewTempo,
    ],
  );
}

export function useSetTempo(callbacks: SetTempoCallbacks): SetTempo<GridMeter> {
  return useSharedSetTempo(SONG_SET_TEMPO, useSongTempoPlayer(), callbacks);
}

export function useTempoPreview(
  tempo: Pick<SetTempo<GridMeter>, 'draft' | 'step'>,
  open: boolean,
) {
  const previewTempo = useLiveSongPlayer((s) => s.previewTempo);
  useSharedTempoPreview(tempo, open, previewTempo);
}

export function useSetTempoOpen(songId: number) {
  const [open, setOpen] = useSongKeyed(songId, false);
  const show = useCallback(() => {
    setOpen(true);
  }, [setOpen]);
  const hide = useCallback(() => {
    setOpen(false);
  }, [setOpen]);
  return { open, show, hide };
}
