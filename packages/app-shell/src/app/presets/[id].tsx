import { PresetEditorScreen } from '@kitbag/tool-metronome';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function PresetEditorRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const navigation = useNavigation();
  const [dirty, setDirty] = useState(false);
  usePreventRemove(dirty, ({ data }) => {
    const discard = () => {
      setDirty(false);
      requestAnimationFrame(() => {
        navigation.dispatch(data.action);
      });
    };
    Alert.alert('Discard changes?', 'Your edits to this song are not saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discard },
    ]);
  });
  const handleDirtyChange = useCallback((next: boolean) => {
    setDirty(next);
  }, []);
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PresetEditorScreen
      presetId={Number(id)}
      insets={insets}
      onBack={routes.back}
      onDirtyChange={handleDirtyChange}
      onOpenPreset={routes.replacePreset}
    />
  );
}
