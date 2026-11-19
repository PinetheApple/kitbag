import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';

import { warn } from '../songLibrary/storeSupport.ts';
import { UNSHIFTED_KEY } from './mix.ts';
import type { RetimeSpeed } from './retimeSpeed.ts';
import { clampedSpeed, wholeKey } from './speedKey.ts';
import type { ActionContext, StemPlayerActions, StemRow } from './store.ts';

type SpeedKeyActions = Pick<
  StemPlayerActions,
  'setSpeed' | 'setSongKey' | 'setStemKey' | 'resetSpeedKey'
>;

type KeyOf = (row: StemRow, track: number) => number;

export function speedKeyActions(
  { set, get, runtimeOf, session }: ActionContext,
  rates: Pick<RetimeSpeed, 'set'>,
  refreshFacts: () => void,
): SpeedKeyActions {
  const editable = () =>
    get().status === 'ready' && get().retime.kind === 'off';

  const save = () => {
    const { setId, speed, songKey, stems } = get();
    if (setId === null) return;
    runtimeOf()
      .records.saveStemSetSpeedKey(setId, {
        speed,
        pitch: songKey,
        stems: stems.map(({ id, key }) => ({ id, pitch: key })),
      })
      .catch((error: unknown) => {
        warn('speed and key not stored', error);
      });
  };

  const sendKeys = async (
    rows: readonly StemRow[],
    before: readonly StemRow[],
  ) => {
    const { commands } = runtimeOf();
    const changed = rows.flatMap((row, track) =>
      row.loaded && row.key !== before[track]?.key ? [track] : [],
    );
    const results = await Promise.all(
      changed.map((track) =>
        commands
          .mixerSetTrackPitch(track, rows[track]?.key ?? UNSHIFTED_KEY)
          .catch(() => KB_RESULT.KB_ERROR_INTERNAL),
      ),
    );
    return changed.filter((_, i) => results[i] !== KB_RESULT.KB_OK);
  };

  const changeKeys = async (songKey: number, keyOf: KeyOf) => {
    if (!editable()) return;
    const opened = session();
    const before = get().stems;
    const stems = before.map((row, track) =>
      row.transposable ? { ...row, key: keyOf(row, track) } : row,
    );
    set({ songKey, stems });
    refreshFacts();
    const failed = await sendKeys(stems, before);
    if (opened !== session()) return;
    if (failed.length > 0) {
      warn('stem key not changed', failed);
      set((s) => ({
        stems: s.stems.map((row, track) =>
          failed.includes(track)
            ? { ...row, key: before[track]?.key ?? row.key }
            : row,
        ),
      }));
    }
    save();
  };

  const setSpeed = async (requested: number) => {
    const speed = clampedSpeed(requested);
    const previous = get().speed;
    if (!editable() || speed === previous) return;
    const opened = session();
    set({ speed });
    refreshFacts();
    const applied = await rates.set(speed);
    if (opened !== session()) return;
    if (applied) {
      save();
      return;
    }
    if (get().speed !== speed) return;
    set({ speed: previous });
    refreshFacts();
  };

  return {
    setSpeed,
    setSongKey: async (requested) => {
      const songKey = wholeKey(requested);
      const previous = get().songKey;
      if (songKey === previous) return;
      await changeKeys(songKey, (row) =>
        row.key === previous ? songKey : row.key,
      );
    },
    setStemKey: async (index, requested) => {
      const key = wholeKey(requested);
      await changeKeys(get().songKey, (row, track) =>
        track === index ? key : row.key,
      );
    },
    resetSpeedKey: async () => {
      await Promise.all([
        setSpeed(KB_MIXER_UNITY_RATE),
        changeKeys(UNSHIFTED_KEY, () => UNSHIFTED_KEY),
      ]);
    },
  };
}
