import { resolveTheme } from '@kitbag/core-design';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const theme = resolveTheme('dark');

// SKELETON (#27): one blank screen to prove the app-shell boots the router.
// The home hub (§9) and the plugin registry are later waves; these are plain
// links until the registry contributes tiles. The §13.3 gate (#32) is the
// proving surface, its 60fps result device-side (#33); the metronome (#46) is
// the first real tool screen.
export default function HomeScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  // The router paints every scene bg.dark; unstyled Text defaults to black.
  text: {
    color: theme.text,
  },
});
