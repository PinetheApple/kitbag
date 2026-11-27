import { createThemedStyles, textRoles, textStyle } from '@kitbag/core-design';

export const useSheetStyles = createThemedStyles((theme) => ({
  songHint: {
    ...textStyle(textRoles.songArtist),
    color: theme.color.text2,
  },
}));
