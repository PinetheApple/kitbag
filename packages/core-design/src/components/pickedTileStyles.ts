import { createThemedStyles } from '../ThemeProvider.tsx';

export const usePickedTileStyles = createThemedStyles((theme) => ({
  selectedTile: {
    borderColor: theme.color.accent,
    backgroundColor: theme.selectedTileFill,
  },
}));
