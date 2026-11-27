const listeners = new Set<() => void>();

export function onMixerSeek(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mixerSeeked(): void {
  for (const listener of listeners) listener();
}
