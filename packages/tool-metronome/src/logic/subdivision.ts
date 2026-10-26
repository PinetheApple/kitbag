// Subdivision badge label: clicks per beat, ×1 to ×16 (SPEC §5.2, §5.1).
export function subdivisionLabel(subdivision: number): string {
  return `×${String(subdivision)}`;
}
