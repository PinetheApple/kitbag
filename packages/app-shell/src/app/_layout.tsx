import '@/global.css';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

// The root view gesture-handler requires for any handler below it — the
// metronome's swipe-anywhere tempo (#46) is the first (SPEC §5.2).
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
