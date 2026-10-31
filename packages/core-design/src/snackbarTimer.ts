export function startSnackbarTimer(
  durationMs: number,
  onTimeout: () => void,
): () => void {
  const timer = setTimeout(onTimeout, durationMs);
  return () => {
    clearTimeout(timer);
  };
}
