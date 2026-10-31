export interface OptionMinWidth {
  readonly minWidth: number;
}

// A floor, not a width, so a label grown by font scale widens instead of wrapping.
export function equalOptionMinWidth(
  labelWidths: readonly number[],
  padding: number,
): OptionMinWidth {
  return { minWidth: Math.max(...labelWidths) + padding * 2 };
}
