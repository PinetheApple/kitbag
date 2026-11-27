import { View } from 'react-native';

import { radius, size } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  dot: {
    width: size.liveDot,
    height: size.liveDot,
    borderRadius: radius.circle,
    backgroundColor: theme.color.green,
  },
}));

export function LiveDot() {
  const styles = useStyles();
  return <View style={styles.dot} />;
}
