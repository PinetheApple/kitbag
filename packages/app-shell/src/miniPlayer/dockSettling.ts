type Unsubscribe = () => void;

interface TransitionEnd {
  readonly data: { readonly closing: boolean };
}

export interface DockNavigation {
  isFocused(): boolean;
  addListener(type: 'blur' | 'focus', listener: () => void): Unsubscribe;
  addListener(
    type: 'transitionEnd',
    listener: (event: TransitionEnd) => void,
  ): Unsubscribe;
}

// rn-screens' Android pop, rns_default_exit_* on API 33+ (200 ms below 33).
export const STACK_POP_MS = 450;

function popFallback(settle: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const start = () => {
    cancel();
    timer = setTimeout(settle, STACK_POP_MS);
  };
  return { start, cancel };
}

// A tap on the bar mid-pop would navigate to the route still being removed.
// rn-screens sends no appear unless a disappear was sent, so a cancelled push gets none.
export function followDockSettling(
  navigation: DockNavigation,
  setSettled: (settled: boolean) => void,
): Unsubscribe {
  let focused = navigation.isFocused();
  let hidden = false;
  const fallback = popFallback(() => {
    setSettled(true);
  });
  const settleNow = () => {
    fallback.cancel();
    setSettled(true);
  };
  const offs = [
    navigation.addListener('blur', () => {
      focused = false;
      hidden = false;
      fallback.cancel();
      setSettled(false);
    }),
    navigation.addListener('focus', () => {
      focused = true;
      if (!hidden) fallback.start();
    }),
    navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing) hidden = true;
      else if (focused) settleNow();
    }),
  ];
  return () => {
    fallback.cancel();
    for (const off of offs) off();
  };
}
