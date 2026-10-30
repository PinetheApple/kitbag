import {
  createThemedStyles,
  metronomeMix,
  mixHex,
  textRoles,
  textStyle,
} from '@kitbag/core-design';

export const useSheetStyles = createThemedStyles((theme) => ({
  songHint: {
    ...textStyle(textRoles.songArtist),
    color: theme.color.text2,
  },
  selectedTile: {
    borderColor: theme.color.accent,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      metronomeMix.selectedTile,
    ),
  },
}));
