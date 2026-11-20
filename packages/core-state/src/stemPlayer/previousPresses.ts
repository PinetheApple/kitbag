export type PreviousListener = (inApp: boolean) => void;

export function previousPresses(session: () => number) {
  const listeners = new Set<PreviousListener>();
  return {
    pressed: (pressedIn: number, inApp = false) => {
      if (pressedIn !== session()) return;
      listeners.forEach((listener) => {
        listener(inApp);
      });
    },
    subscribe: (listener: PreviousListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
