// A floor, not a width: a label that grows with font scale widens its option
// instead of wrapping, and onLayout then raises the shared floor.
export function equalOptionSize(
  labelWidths: readonly number[],
  padding: number,
): { readonly minWidth: number } {
  return { minWidth: Math.max(...labelWidths) + padding * 2 };
}
