import type { SongTransportOrder } from '@kitbag/core-native';

import { getStemPlayer } from '../stemPlayer/runtime.ts';
import { upNext, type PlayOrder } from './order.ts';
import { playOrderNow, subscribePlayOrder } from './orderNow.ts';
import { backFromNow, backOf } from './previous.ts';

export function cardOrderOf(
  order: PlayOrder,
  back: boolean,
): SongTransportOrder {
  const next = upNext(order) !== undefined;
  return { previous: next || back || order.cursor !== null, next };
}

export interface CardOrderDeps {
  readonly order: () => PlayOrder;
  readonly back: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly send: (order: SongTransportOrder) => void;
}

function canGoBack(): boolean {
  const from = backFromNow();
  return from !== null && backOf(from) !== null;
}

const defaultDeps: CardOrderDeps = {
  order: playOrderNow,
  back: canGoBack,
  subscribe: subscribePlayOrder,
  send: (order) => {
    getStemPlayer().commands.songTransportOrder(order);
  },
};

export function startCardOrder(deps: CardOrderDeps = defaultDeps) {
  let sent: SongTransportOrder | null = null;
  const push = () => {
    const order = cardOrderOf(deps.order(), deps.back());
    if (sent?.previous === order.previous && sent.next === order.next) return;
    sent = order;
    deps.send(order);
  };
  push();
  return deps.subscribe(push);
}
