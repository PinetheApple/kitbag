// A flex: 1 option in a shrink-to-fit track takes an equal share of the
// options' summed natural widths, which is how the design's segment sizes.
export function equalOptionWidth(
  labelWidths: readonly number[],
  padding: number,
): number {
  const total = labelWidths.reduce((sum, width) => sum + width, 0);
  return total / labelWidths.length + padding * 2;
}
