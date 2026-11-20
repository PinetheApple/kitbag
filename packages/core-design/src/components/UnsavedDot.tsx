import { View } from 'react-native';

import { metronome } from '../metronomeRoles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  dot: {
    width: metronome.unsavedDot,
    height: metronome.unsavedDot,
    borderRadius: metronome.unsavedDot / 2,
    flexShrink: 0,
    backgroundColor: theme.color[theme.accentInk],
  },
}));

export function UnsavedDot() {
  const styles = useStyles();
  return <View style={styles.dot} />;
}
