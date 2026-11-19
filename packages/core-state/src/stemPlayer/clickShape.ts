import {
  CLICK_RATE,
  stemSetClickViolation,
  type ClickRate,
  type StemSetClick,
} from '@kitbag/core-db';
import { KB_GRID_RATE, KB_RESULT } from '@kitbag/core-native';

import { warn } from '../songLibrary/storeSupport.ts';
import type { MixerRuntime } from './runtime.ts';
import type {
  ActionContext,
  StemPlayerActions,
  StemPlayerState,
} from './store.ts';

const ENGINE_GRID_RATE: Readonly<Record<ClickRate, KB_GRID_RATE>> = {
  [CLICK_RATE.single]: KB_GRID_RATE.KB_GRID_RATE_SINGLE,
  [CLICK_RATE.double]: KB_GRID_RATE.KB_GRID_RATE_DOUBLE,
  [CLICK_RATE.half]: KB_GRID_RATE.KB_GRID_RATE_HALF,
};

type ClickField = keyof StemSetClick;

function sent(what: string) {
  return {
    done: (result: number) => {
      if (result !== KB_RESULT.KB_OK) warn(`click ${what} refused`, result);
    },
    failed: (error: unknown) => {
      warn(`click ${what} failed`, error);
    },
  };
}

export function clickSenders(
  get: () => Pick<StemPlayerState, ClickField>,
  runtimeOf: () => Pick<MixerRuntime, 'commands'>,
): Readonly<Record<ClickField, () => void>> {
  const grouping = sent('grouping');
  const rate = sent('rate');
  return {
    clickGrouping: () => {
      runtimeOf()
        .commands.setGridGrouping(get().clickGrouping)
        .then(grouping.done, grouping.failed);
    },
    clickRate: () => {
      runtimeOf()
        .commands.setGridRate(ENGINE_GRID_RATE[get().clickRate])
        .then(rate.done, rate.failed);
    },
  };
}

const patchOf = <K extends ClickField>(field: K, value: StemSetClick[K]) =>
  ({ [field]: value }) as Pick<StemSetClick, K>;

function clickChanger(
  { set, get, runtimeOf, session }: ActionContext,
  send: Readonly<Record<ClickField, () => void>>,
) {
  const apply = <K extends ClickField>(field: K, value: StemSetClick[K]) => {
    set(patchOf(field, value));
    if (get().click) send[field]();
  };
  return async <K extends ClickField>(field: K, value: StemSetClick[K]) => {
    const { status, setId } = get();
    const previous = get()[field];
    const patch = patchOf(field, value);
    if (status !== 'ready' || setId === null) return;
    if (stemSetClickViolation(patch) !== null) return;
    const opened = session();
    apply(field, value);
    try {
      await runtimeOf().records.saveStemSetClick(setId, patch);
    } catch (error: unknown) {
      warn('click setting not stored', error);
      if (opened === session() && get()[field] === value)
        apply(field, previous);
    }
  };
}

export function clickShapeActions(context: ActionContext) {
  const send = clickSenders(context.get, context.runtimeOf);
  const change = clickChanger(context, send);
  const actions: Pick<StemPlayerActions, 'setClickGrouping' | 'setClickRate'> =
    {
      setClickGrouping: (groups) => change('clickGrouping', groups),
      setClickRate: (rate) => change('clickRate', rate),
    };
  const gridSent = () => {
    send.clickGrouping();
    send.clickRate();
  };
  return { actions, gridSent };
}
