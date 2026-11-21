import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { PLAYER_SCROLL_ID, usePlayerScroll } from '../playerScroll.ts';

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
});

export function PlayerScroll({ children }: { readonly children: ReactNode }) {
  const scroll = usePlayerScroll();
  return (
    <ScrollView
      testID={PLAYER_SCROLL_ID}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      {...scroll}
    >
      {children}
    </ScrollView>
  );
}
