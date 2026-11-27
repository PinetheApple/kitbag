import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { TOOL_ROUTES } from '@/home/toolRoutes';
import { SessionDetailScreen } from '@/practice/SessionDetailScreen';
import { useSettingsRoutes } from '@/settings/settingsRoutes';

export default function PracticeSessionRoute() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const routes = useSettingsRoutes();
  const router = useRouter();
  const openMetronome = useCallback(() => {
    router.push(TOOL_ROUTES.metronome.home);
  }, [router]);
  return (
    <SessionDetailScreen
      uuid={uuid}
      onBack={routes.back}
      onLoaded={openMetronome}
    />
  );
}
