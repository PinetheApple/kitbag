export interface TapOnce {
  readonly pressIn: () => void;
  readonly press: () => void;
}

// A tap lands on touch-down, so release lag stays out of the timing; a screen
// reader activates with a press that never had a touch-down.
export function tapOnce(tap: () => void): TapOnce {
  let landed = false;
  return {
    pressIn: () => {
      landed = true;
      tap();
    },
    press: () => {
      if (!landed) tap();
      landed = false;
    },
  };
}
