// Holds a picked value while it saves, so a re-read cannot bring back the older one.
export function heldWhileSaving<T>() {
  let held: T | null = null;
  let saves = 0;
  return {
    current: () => held,
    hold: (value: T) => {
      held = value;
      return ++saves;
    },
    settle: (save = saves) => {
      if (save === saves) held = null;
    },
    reset: () => {
      held = null;
    },
  };
}
