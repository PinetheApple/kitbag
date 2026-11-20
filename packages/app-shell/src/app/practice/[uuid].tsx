import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SessionDetailScreen } from '@/practice/SessionDetailScreen';
import { useSettingsRoutes } from '@/settings/settingsRoutes';

export default function PracticeSessionRoute() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const routes = useSettingsRoutes();
  const router = useRouter();
  const openMetronome = useCallback(() => {
    router.push('/metronome');
  }, [router]);
  return (
    <SessionDetailScreen
      uuid={uuid}
      onBack={routes.back}
      onLoaded={openMetronome}
    />
  );
}
