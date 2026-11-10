type Unsubscribe = () => void;

interface TransitionEnd {
  readonly data: { readonly closing: boolean };
}

export interface DockNavigation {
  addListener(type: 'blur', listener: () => void): Unsubscribe;
  addListener(
    type: 'transitionEnd',
    listener: (event: TransitionEnd) => void,
  ): Unsubscribe;
}

// A tap on the bar mid-pop would navigate to the route still being removed.
export function followDockSettling(
  navigation: DockNavigation,
  setSettled: (settled: boolean) => void,
): Unsubscribe {
  const offBlur = navigation.addListener('blur', () => {
    setSettled(false);
  });
  const offEnd = navigation.addListener('transitionEnd', (event) => {
    if (!event.data.closing) setSettled(true);
  });
  return () => {
    offBlur();
    offEnd();
  };
}
