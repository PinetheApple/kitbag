import type { StemSetRecord, StemSetSpeedKey } from '@kitbag/core-db';
import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';

import { warn } from '../songLibrary/storeSupport.ts';
import { UNSHIFTED_KEY } from './mix.ts';
import type { PlaybackShift } from './facts.ts';
import { retimeSpeed, type RetimeSpeed } from './retimeSpeed.ts';
import { clampedSpeed, wholeKey } from './speedKey.ts';
import type { ActionContext, StemPlayerActions, StemRow } from './store.ts';
import { gridFacts } from './tempoActions.ts';

type SpeedKeyActions = Pick<
  StemPlayerActions,
  'setSpeed' | 'setSongKey' | 'setStemKey' | 'resetSpeedKey'
>;

type KeyOf = (row: StemRow, track: number) => number;

export const songKeyOf =
  (previous: number, songKey: number): KeyOf =>
  (row) =>
    row.key === previous ? songKey : row.key;

export const stemKeyOf =
  (index: number, key: number): KeyOf =>
  (row, track) =>
    track === index ? key : row.key;

export const unshiftedKey: KeyOf = () => UNSHIFTED_KEY;

export function keyedRows(rows: readonly StemRow[], keyOf: KeyOf): StemRow[] {
  return rows.map((row, track) =>
    row.transposable ? { ...row, key: keyOf(row, track) } : row,
  );
}

export function speedKeyChange(
  speed: number,
  songKey: number,
  stems: readonly StemRow[],
): StemSetSpeedKey {
  return {
    speed,
    pitch: songKey,
    stems: stems.map(({ id, key }) => ({ id, pitch: key })),
  };
}

interface KeyPlan {
  readonly songKey: number;
  readonly keyOf: KeyOf;
}

export interface Persisted {
  speed: number;
}

export function speedKeyActions(
  { set, get, runtimeOf, session }: ActionContext,
  rates: Pick<RetimeSpeed, 'set'>,
  refreshFacts: () => void,
  persisted: Persisted,
): SpeedKeyActions {
  const editable = () =>
    get().status === 'ready' && get().retime.kind === 'off';

  const save = () => {
    const { setId, songKey, stems } = get();
    if (setId === null) return;
    runtimeOf()
      .records.saveStemSetSpeedKey(
        setId,
        speedKeyChange(persisted.speed, songKey, stems),
      )
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
    return {
      sent: changed.length,
      failed: changed.filter((_, i) => results[i] !== KB_RESULT.KB_OK),
    };
  };

  const tookNoKey = (rows: readonly StemRow[], sent: number, failed: number) =>
    sent === 0
      ? !rows.some((row) => row.transposable && row.loaded)
      : failed === sent;

  const applyKeys = async (plan: KeyPlan | null) => {
    if (plan === null || !editable()) return;
    const { songKey, keyOf } = plan;
    const opened = session();
    const { stems: before, songKey: previous } = get();
    const stems = keyedRows(before, keyOf);
    set({ songKey, stems });
    refreshFacts();
    const { sent, failed } = await sendKeys(stems, before);
    if (opened !== session()) return;
    if (failed.length > 0) warn('stem key not changed', failed);
    if (tookNoKey(stems, sent, failed.length)) {
      set({ songKey: previous, stems: before });
      refreshFacts();
      return;
    }
    set((s) => ({
      stems: s.stems.map((row, track) =>
        failed.includes(track)
          ? { ...row, key: before[track]?.key ?? row.key }
          : row,
      ),
    }));
    save();
  };

  let keySteps: Promise<void> = Promise.resolve();
  const changeKeys = (plan: () => KeyPlan | null) => {
    keySteps = keySteps
      .then(() => applyKeys(plan()))
      .catch((error: unknown) => {
        warn('key not changed', error);
      });
    return keySteps;
  };

  const persistShownSpeed = (speed: number) => {
    if (speed === persisted.speed) return;
    persisted.speed = speed;
    save();
  };

  const setSpeed = async (requested: number) => {
    const speed = clampedSpeed(requested);
    const previous = get().speed;
    if (!editable()) return;
    if (speed === previous) {
      persistShownSpeed(speed);
      return;
    }
    const opened = session();
    set({ speed });
    refreshFacts();
    const applied = await rates.set(speed);
    if (opened !== session()) return;
    if (applied) {
      persisted.speed = speed;
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
      await changeKeys(() => {
        const previous = get().songKey;
        if (songKey === previous) return null;
        return { songKey, keyOf: songKeyOf(previous, songKey) };
      });
    },
    setStemKey: async (index, requested) => {
      const key = wholeKey(requested);
      await changeKeys(() => ({
        songKey: get().songKey,
        keyOf: stemKeyOf(index, key),
      }));
    },
    resetSpeedKey: async () => {
      await Promise.all([
        setSpeed(KB_MIXER_UNITY_RATE),
        changeKeys(() => ({ songKey: UNSHIFTED_KEY, keyOf: unshiftedKey })),
      ]);
    },
  };
}

export function speedKeySession(
  context: ActionContext,
  rateSet: (rate: number) => void,
  openRecord: () => StemSetRecord | null,
) {
  const { set, get, runtimeOf, session } = context;
  const rates = retimeSpeed(() => runtimeOf().commands, session, rateSet);
  const persisted: Persisted = { speed: KB_MIXER_UNITY_RATE };
  const shift = (): PlaybackShift => ({
    speed: get().speed,
    key: get().songKey,
  });
  const refreshFacts = () => {
    const record = openRecord();
    if (record === null) return;
    set(gridFacts(record, get().tempoMode, shift()));
  };
  return {
    rates,
    persisted,
    shift,
    actions: speedKeyActions(context, rates, refreshFacts, persisted),
  };
}
