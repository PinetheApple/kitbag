import { TempoModeSheet } from '@kitbag/core-design';
import {
  constantLine,
  tempoHint,
  tempoOptions,
  useSongPlayer,
  type TempoMode,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

interface SongTempoModeProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function SongTempoMode({
  visible,
  bottomInset,
  onClose,
}: SongTempoModeProps) {
  const tempo = useSongPlayer((s) => s.tempo);
  const mode = useSongPlayer((s) => s.tempoMode);
  const setTempoMode = useSongPlayer((s) => s.setTempoMode);
  const options = useMemo(() => tempoOptions(tempo), [tempo]);
  const pick = useCallback(
    (picked: TempoMode) => {
      void setTempoMode(picked);
    },
    [setTempoMode],
  );
  return (
    <TempoModeSheet
      visible={visible}
      bottomInset={bottomInset}
      options={options}
      selected={mode}
      constantLine={constantLine(tempo)}
      hint={tempo === null || mode === null ? null : tempoHint(tempo, mode)}
      onSelect={pick}
      onClose={onClose}
    />
  );
}
