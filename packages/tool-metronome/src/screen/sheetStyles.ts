import { createThemedStyles, metronomeMix, mixHex } from '@kitbag/core-design';

export const useSheetStyles = createThemedStyles((theme) => ({
  selectedTile: {
    borderColor: theme.color.accent,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      metronomeMix.selectedTile,
    ),
  },
}));
