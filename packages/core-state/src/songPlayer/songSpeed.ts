import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';

import { warn } from '../songLibrary/storeSupport.ts';
import type { MixerSessionContext } from '../stemPlayer/mixerSession.ts';
import { retimeSpeed } from '../stemPlayer/retimeSpeed.ts';
import { clampedSpeed } from '../stemPlayer/speedKey.ts';
import type { SongPlayerActions } from './actions.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import type { SongPlayerState } from './state.ts';

interface SongSpeedContext extends Omit<
  MixerSessionContext<SongPlayerState>,
  'runtimeOf'
> {
  readonly runtimeOf: () => SongPlayerRuntime;
}

type OpeningRate = (opened: number, rate: number) => Promise<number | null>;

export function songSpeed(
  { set, get, runtimeOf, session }: SongSpeedContext,
  rateSet: (rate: number) => void,
) {
  const rates = retimeSpeed(() => runtimeOf().commands, session, rateSet);

  const save = (speed: number) => {
    const { songId } = get();
    if (songId === null) return;
    runtimeOf()
      .records.saveSongSpeed(songId, speed)
      .catch((error: unknown) => {
        warn('song speed not stored', error);
      });
  };

  const setSpeed = async (requested: number) => {
    const speed = clampedSpeed(requested);
    const previous = get().speed;
    if (get().status !== 'ready' || speed === previous) return;
    const opened = session();
    set({ speed });
    const applied = await rates.set(speed);
    if (opened !== session()) return;
    if (applied) {
      save(speed);
      return;
    }
    if (get().speed === speed) set({ speed: previous });
  };

  const actions: Pick<SongPlayerActions, 'setSpeed' | 'resetSpeed'> = {
    setSpeed,
    resetSpeed: () => setSpeed(KB_MIXER_UNITY_RATE),
  };

  return {
    actions,
    opening: async (
      opened: number,
      stored: number,
      applyOpeningRate: OpeningRate,
    ) => {
      const speed = await applyOpeningRate(opened, clampedSpeed(stored));
      if (speed === null) return false;
      rateSet(speed);
      set({ speed });
      return true;
    },
  };
}
