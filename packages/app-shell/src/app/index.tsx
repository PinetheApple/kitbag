import { createThemedStyles, space } from '@kitbag/core-design';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function HomeScreen() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Kitbag</Text>
      <Link href="/metronome" style={styles.text}>
        Metronome
      </Link>
      <Link href="/gate" style={styles.text}>
        60fps gate
      </Link>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sectionGap,
  },
  text: {
    color: theme.color.text,
  },
}));
