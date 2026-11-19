import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({ anchor: { height: 0 } });

export function NoteAnchor({ children }: { readonly children: ReactNode }) {
  return <View style={styles.anchor}>{children}</View>;
}
