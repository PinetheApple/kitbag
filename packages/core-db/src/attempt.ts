export function attempt(work: () => void): unknown[] {
  try {
    work();
    return [];
  } catch (error) {
    return [error];
  }
}
