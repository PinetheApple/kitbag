import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// SKELETON (#27): one blank screen to prove the app-shell boots the router.
// The home hub (§9), the plugin registry and the tool surfaces are later Phase 2
// / Phase 3 waves. The only real screen so far is the §13.3 gate (#32), linked
// below; its 60fps proof is device-side (#33), not here.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>Kitbag</Text>
      <Link href="/gate">60fps gate</Link>
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
});
