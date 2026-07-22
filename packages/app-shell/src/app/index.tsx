import { StyleSheet, Text, View } from 'react-native';

// SKELETON (#27): one blank screen to prove the app-shell boots the router.
// The home hub (§9), the plugin registry and the 60fps surfaces are later
// Phase 2 / Phase 3 waves. Device boot itself is verified in #33, not here.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>Kitbag</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
