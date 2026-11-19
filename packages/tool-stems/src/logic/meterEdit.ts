import {
  meterLabel,
  tenthsClock,
  type MeterGridState,
} from '@kitbag/core-design';
import {
  nearestBeat,
  NO_METER_OVERRIDE,
  type GridMeter,
  type MeterOverride,
} from '@kitbag/core-state';

const SAVED = 'Saved for this song.';
const UNDO = 'Undo';
const TRY_AGAIN = 'Try again';
export const NOT_SAVED = 'The meter was not saved.';
export const NO_GRID_REASON = 'Needs a beat grid. This song came without one.';

export type MeterEdit =
  | { readonly kind: 'meter'; readonly meter: GridMeter }
  | { readonly kind: 'barOne'; readonly seconds: number }
  | { readonly kind: 'reset' };

export interface MeterRestore {
  readonly setId: number;
  readonly override: MeterOverride;
}

export interface MeterNotice {
  readonly message: string;
  readonly actionLabel: string;
  readonly restore: MeterRestore;
  readonly afterRestore: MeterNotice | null;
}

export interface MeterEditTarget {
  readonly setId: number;
  readonly override: MeterOverride;
  readonly detected: number;
}

export interface MeterEditorDeps {
  readonly save: (setId: number, override: MeterOverride) => Promise<void>;
  readonly applied: (setId: number, override: MeterOverride) => void;
  readonly target: () => MeterEditTarget | null;
}

export function meterGridState(beats: readonly number[]): MeterGridState {
  return beats.length > 0 ? 'ready' : 'failed';
}

export function barOneHere(
  beats: readonly number[],
  playheadSeconds: number,
): number | null {
  const index = nearestBeat(beats, playheadSeconds);
  return index === null ? null : (beats[index] ?? null);
}

function sameOverride(a: MeterOverride, b: MeterOverride): boolean {
  return (
    a.meterBeatsPerBar === b.meterBeatsPerBar &&
    a.barOneSeconds === b.barOneSeconds
  );
}

export function shownMeter(override: MeterOverride, detected: number): number {
  return override.meterBeatsPerBar ?? detected;
}

export function editedOverride(
  current: MeterOverride,
  edit: MeterEdit,
  detected: number,
): MeterOverride | null {
  if (edit.kind === 'meter' && edit.meter === shownMeter(current, detected))
    return null;
  const next =
    edit.kind === 'reset'
      ? NO_METER_OVERRIDE
      : edit.kind === 'meter'
        ? { ...current, meterBeatsPerBar: edit.meter }
        : { ...current, barOneSeconds: edit.seconds };
  return sameOverride(current, next) ? null : next;
}

function editMessage(edit: MeterEdit): string {
  if (edit.kind === 'barOne')
    return `Bar 1 moved to ${tenthsClock(edit.seconds)}. ${SAVED}`;
  if (edit.kind === 'meter')
    return `Meter set to ${meterLabel(edit.meter)}. ${SAVED}`;
  return `Using the detected meter and bar 1. ${SAVED}`;
}

const retry = (
  restore: MeterRestore,
  afterRestore: MeterNotice | null,
): MeterNotice => ({
  message: NOT_SAVED,
  actionLabel: TRY_AGAIN,
  restore,
  afterRestore,
});

function savedNotice(edit: MeterEdit, previous: MeterRestore): MeterNotice {
  return {
    message: editMessage(edit),
    actionLabel: UNDO,
    restore: previous,
    afterRestore: null,
  };
}

function serially() {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(op: () => Promise<T>): Promise<T> => {
    const run = last.then(op);
    last = run.catch(() => undefined);
    return run;
  };
}

export function createMeterEditor({ save, applied, target }: MeterEditorDeps) {
  const stored = async ({ setId, override }: MeterRestore) => {
    try {
      await save(setId, override);
    } catch (error: unknown) {
      console.warn('[kitbag] meter override not stored', error);
      return false;
    }
    applied(setId, override);
    return true;
  };
  const edited = async (edit: MeterEdit): Promise<MeterNotice | null> => {
    const current = target();
    if (current === null) return null;
    const { setId, override, detected } = current;
    const next = editedOverride(override, edit, detected);
    if (next === null) return null;
    const saved = savedNotice(edit, { setId, override });
    const wanted = { setId, override: next };
    return (await stored(wanted)) ? saved : retry(wanted, saved);
  };
  const restored = async (notice: MeterNotice) =>
    (await stored(notice.restore))
      ? notice.afterRestore
      : retry(notice.restore, notice.afterRestore);
  const queue = serially();
  return {
    edit: (edit: MeterEdit) => queue(() => edited(edit)),
    act: (notice: MeterNotice) => queue(() => restored(notice)),
  };
}

export type MeterEditor = ReturnType<typeof createMeterEditor>;
