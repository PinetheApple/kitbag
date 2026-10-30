import { useMetronome } from '@kitbag/core-state';
import { useMemo } from 'react';

import type { PracticeSettings } from '../logic/statusRows.ts';

export function usePracticeSettings(): PracticeSettings {
  const ramp = useMetronome((s) => s.ramp);
  const barMute = useMetronome((s) => s.barMute);
  const countIn = useMetronome((s) => s.countIn);
  const polyEnabled = useMetronome((s) => s.polyEnabled);
  const polyBeats = useMetronome((s) => s.polyBeats);
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  return useMemo(
    () => ({ ramp, barMute, countIn, polyEnabled, polyBeats, beatsPerBar }),
    [ramp, barMute, countIn, polyEnabled, polyBeats, beatsPerBar],
  );
}
