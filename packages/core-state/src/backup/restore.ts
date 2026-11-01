import type {
  Category,
  CategoryPlan,
  Conflict,
  ImportFailure,
  ImportMode,
  ImportPlan,
  Resolution,
  Resolutions,
} from '@kitbag/core-db';
import { createStore } from 'zustand/vanilla';

import {
  categoriesForMode,
  isReplaceConfirmed,
  toggledCategories,
} from './categories.ts';
import { getBackup, type BackupDeps } from './runtime.ts';

export type RestoreFailure = ImportFailure | { readonly kind: 'unreadable' };

export interface RestoreSource {
  readonly name: string;
  readonly bytes: number;
}

export interface RestoreReview {
  readonly phase: 'review' | 'applying';
  readonly source: RestoreSource;
  readonly contents: string;
  readonly plan: ImportPlan;
  readonly resolutions: Resolutions;
  readonly planning: boolean;
  readonly stale: boolean;
}

export type RestoreState =
  | { readonly phase: 'empty' | 'reading' }
  | { readonly phase: 'failed'; readonly failure: RestoreFailure }
  | RestoreReview
  | {
      readonly phase: 'done';
      readonly mode: ImportMode;
      readonly counts: Partial<Record<Category, CategoryPlan>>;
    };

export interface RestoreActions {
  pick: () => Promise<void>;
  setMode: (mode: ImportMode) => Promise<void>;
  toggleCategory: (category: Category) => Promise<void>;
  resolve: (conflict: Conflict, resolution: Resolution) => Promise<void>;
  apply: (typedConfirmation?: string) => Promise<void>;
  reset: () => void;
}

export type RestoreStore = { readonly restore: RestoreState } & RestoreActions;

const EMPTY: RestoreState = { phase: 'empty' };

export function planConflicts(plan: ImportPlan): Conflict[] {
  return plan.categories.flatMap(
    (category) => plan.counts[category]?.conflicts ?? [],
  );
}

export function canApply(state: RestoreState): boolean {
  return (
    state.phase === 'review' &&
    !state.planning &&
    state.plan.unresolved.length === 0
  );
}

interface PlanRequest {
  readonly mode: ImportMode;
  readonly categories?: readonly Category[];
  readonly resolutions: Resolutions;
}

export function createRestoreStore(deps: () => BackupDeps = getBackup) {
  return createStore<RestoreStore>()((set, get) => {
    let request = 0;
    const show = (restore: RestoreState) => {
      set({ restore });
    };
    const review = () => {
      const { restore } = get();
      return restore.phase === 'review' ? restore : null;
    };

    const replan = async (
      base: Pick<RestoreReview, 'source' | 'contents'>,
      options: PlanRequest,
      stale = false,
    ) => {
      const ticket = ++request;
      const current = review();
      if (current !== null) show({ ...current, planning: true });
      const result = await deps().service().plan(base.contents, options);
      if (ticket !== request) return;
      if (!result.ok) {
        show({ phase: 'failed', failure: result.error });
        return;
      }
      show({
        phase: 'review',
        ...base,
        plan: result.value,
        resolutions: options.resolutions,
        planning: false,
        stale,
      });
    };

    const replanCurrent = (change: (state: RestoreReview) => PlanRequest) => {
      const state = review();
      if (state === null) return Promise.resolve();
      return replan(state, change(state));
    };

    const finish = async (state: RestoreReview, confirmReplace: boolean) => {
      show({ ...state, phase: 'applying' });
      const result = await deps()
        .service()
        .apply(state.plan, { confirmReplace });
      if (result.ok) {
        show({ phase: 'done', mode: state.plan.mode, counts: result.value });
        await deps().afterRestore();
        return;
      }
      if (result.error.kind === 'stalePlan') {
        const { mode, categories } = state.plan;
        await replan(
          state,
          { mode, categories, resolutions: state.resolutions },
          true,
        );
        return;
      }
      show({ phase: 'failed', failure: result.error });
    };

    return {
      restore: EMPTY,
      pick: async () => {
        request += 1;
        show({ phase: 'reading' });
        let picked;
        try {
          picked = await deps().pick();
        } catch {
          show({ phase: 'failed', failure: { kind: 'unreadable' } });
          return;
        }
        if (picked === null) {
          show(EMPTY);
          return;
        }
        const source = { name: picked.name, bytes: picked.bytes };
        await replan(
          { source, contents: picked.contents },
          { mode: 'merge', resolutions: {} },
        );
      },
      setMode: (mode) =>
        replanCurrent(({ plan, resolutions }) => ({
          mode,
          categories: categoriesForMode(
            plan.categories,
            mode,
            plan.file.categories,
          ),
          resolutions,
        })),
      toggleCategory: (category) =>
        replanCurrent(({ plan, resolutions }) => ({
          mode: plan.mode,
          categories: toggledCategories(
            plan.categories,
            category,
            plan.mode,
            plan.file.categories,
          ),
          resolutions,
        })),
      resolve: (conflict, resolution) =>
        replanCurrent(({ plan, resolutions }) => ({
          mode: plan.mode,
          categories: plan.categories,
          resolutions: {
            ...resolutions,
            [conflict.category]: {
              ...resolutions[conflict.category],
              [conflict.key]: resolution,
            },
          },
        })),
      apply: async (typedConfirmation = '') => {
        const state = get().restore;
        if (state.phase !== 'review' || !canApply(state)) return;
        const replacing = state.plan.mode === 'replace';
        if (replacing && !isReplaceConfirmed(typedConfirmation)) return;
        await finish(state, replacing);
      },
      reset: () => {
        request += 1;
        show(EMPTY);
      },
    };
  });
}

export const restoreStore = createRestoreStore();
