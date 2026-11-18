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

// A tap on the bar mid-pop would navigate to the route still being removed.
// A push cancelled before the screen finished hiding sends it no appear event.
export function followDockSettling(
  navigation: DockNavigation,
  setSettled: (settled: boolean) => void,
): Unsubscribe {
  let hidden = false;
  const offBlur = navigation.addListener('blur', () => {
    hidden = false;
    setSettled(false);
  });
  const offFocus = navigation.addListener('focus', () => {
    if (!hidden) setSettled(true);
  });
  const offEnd = navigation.addListener('transitionEnd', (event) => {
    if (event.data.closing) hidden = true;
    else setSettled(true);
  });
  return () => {
    offBlur();
    offFocus();
    offEnd();
  };
}
