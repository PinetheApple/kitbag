import { createThemedStyles, textRoles, textStyle } from '@kitbag/core-design';

export const useSheetStyles = createThemedStyles((theme) => ({
  songHint: {
    ...textStyle(textRoles.songArtist),
    color: theme.color.text2,
  },
  selectedTile: {
    borderColor: theme.color.accent,
    backgroundColor: theme.selectedTileFill,
  },
}));
