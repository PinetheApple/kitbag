import { isLibraryChip, useLastTool } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function LibraryRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routes = useLibraryRoutes();
  const markUsed = useLastTool((s) => s.markUsed);
  const { chip } = useLocalSearchParams<{ chip?: string }>();

  useEffect(() => {
    markUsed(TOOL_ID.library);
  }, [markUsed]);

  const back = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <LibraryScreen
      insets={insets}
      onBack={back}
      onOpenStemSet={routes.openStemSet}
      {...(isLibraryChip(chip) ? { initialChip: chip } : {})}
    />
  );
}
