import {
  tuningViolation,
  type TuningRepository,
  type TuningShape,
} from '@kitbag/core-db';

import type {
  CustomTuning,
  CustomTuningActions,
  TunerState,
  TunerStore,
  TunerTuning,
} from './types.ts';

/** The one tuning-validity rule: core-db's, which the engine limits pin. */
export function isValidTuning(tuning: TuningShape): boolean {
  return tuningViolation(tuning) === undefined;
}

export function tuningFromCustom(row: CustomTuning): TunerTuning {
  return {
    name: row.name,
    instrument: row.instrument,
    notes: row.notes,
    customId: row.id,
  };
}

function samePitches(a: TunerTuning, b: TunerTuning): boolean {
  return (
    a.instrument === b.instrument &&
    a.notes.length === b.notes.length &&
    a.notes.every((note, i) => note === b.notes[i])
  );
}

type SetState = (
  partial: Partial<TunerState> | ((state: TunerStore) => Partial<TunerState>),
) => void;

export function customTuningActions(
  set: SetState,
  get: () => TunerStore,
  tunings: () => TuningRepository,
): CustomTuningActions {
  return {
    loadCustomTunings: async () => {
      const rows = await tunings().list();
      set({ customTunings: rows });
    },

    createCustomTuning: async (values) => {
      const row = await tunings().create(values);
      set((s) => ({ customTunings: [...s.customTunings, row] }));
      return row;
    },

    updateCustomTuning: async (id, values) => {
      await tunings().update(id, values);
      const previous = get().customTunings.find((row) => row.id === id);
      if (previous === undefined) return;
      const updated: CustomTuning = { ...previous, ...values };
      set((s) => ({
        customTunings: s.customTunings.map((row) =>
          row.id === id ? updated : row,
        ),
      }));
      const current = get().tuning;
      if (current?.customId !== id) return;
      const next = tuningFromCustom(updated);
      // A rename keeps the mode and the strings already tuned this visit.
      if (samePitches(current, next)) set({ tuning: next });
      else get().setTuning(next);
    },

    deleteCustomTuning: async (id) => {
      await tunings().delete(id);
      set((s) => ({
        customTunings: s.customTunings.filter((row) => row.id !== id),
      }));
      // The notes stay selected for this visit; only the link to the row goes.
      const current = get().tuning;
      if (current?.customId === id) {
        set({
          tuning: {
            name: current.name,
            instrument: current.instrument,
            notes: current.notes,
          },
        });
      }
    },
  };
}
