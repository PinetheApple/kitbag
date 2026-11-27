export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  readonly flush: () => void;
  readonly cancel: () => void;
}

export function debounce<A extends unknown[]>(
  run: (...args: A) => void,
  delayMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };
  const flush = () => {
    const args = pending;
    cancel();
    if (args !== undefined) run(...args);
  };
  const call = (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    pending = args;
    timer = setTimeout(flush, delayMs);
  };
  return Object.assign(call, { flush, cancel });
}
