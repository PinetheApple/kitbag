import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

import { followDockSettling, type DockNavigation } from './dockSettling.ts';

export function useDockSettled(): boolean {
  const navigation = useNavigation<DockNavigation>();
  const [settled, setSettled] = useState(() => navigation.isFocused());
  useEffect(() => followDockSettling(navigation, setSettled), [navigation]);
  return settled;
}
