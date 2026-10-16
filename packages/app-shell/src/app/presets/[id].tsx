import {
  DiscardChangesSheet,
  PresetEditorScreen,
} from '@kitbag/tool-metronome';
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function useDiscardGuard() {
  const navigation = useNavigation();
  const [dirty, setDirty] = useState(false);
  const [blocked, setBlocked] = useState<NavigationAction | null>(null);
  usePreventRemove(dirty, ({ data }) => {
    setBlocked(data.action);
  });
  const keep = useCallback(() => {
    setBlocked(null);
  }, []);
  const discard = useCallback(() => {
    const action = blocked;
    setBlocked(null);
    setDirty(false);
    if (action === null) return;
    requestAnimationFrame(() => {
      navigation.dispatch(action);
    });
  }, [blocked, navigation]);
  return { pending: blocked !== null, setDirty, keep, discard };
}

export default function PresetEditorRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const guard = useDiscardGuard();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <PresetEditorScreen
        presetId={Number(id)}
        insets={insets}
        onBack={routes.back}
        onDirtyChange={guard.setDirty}
        onOpenPreset={routes.replacePreset}
      />
      <DiscardChangesSheet
        visible={guard.pending}
        bottomInset={insets.bottom}
        onKeep={guard.keep}
        onDiscard={guard.discard}
      />
    </>
  );
}
