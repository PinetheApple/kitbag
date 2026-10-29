import { StemPlayerScreen } from '@kitbag/tool-stems';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function StemPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <StemPlayerScreen setId={Number(id)} insets={insets} onBack={routes.back} />
  );
}
