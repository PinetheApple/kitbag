import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { PracticeHistoryScreen } from '@/practice/PracticeHistoryScreen';
import { useSettingsRoutes } from '@/settings/settingsRoutes';

export default function PracticeHistoryRoute() {
  const routes = useSettingsRoutes();
  const router = useRouter();
  const openSession = useCallback(
    (uuid: string) => {
      router.push({ pathname: '/practice/[uuid]', params: { uuid } });
    },
    [router],
  );
  const openMetronome = useCallback(() => {
    router.push('/metronome');
  }, [router]);
  return (
    <PracticeHistoryScreen
      onBack={routes.back}
      onOpenSession={openSession}
      onOpenMetronome={openMetronome}
    />
  );
}
