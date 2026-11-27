import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { TOOL_ROUTES } from '@/home/toolRoutes';
import { PracticeHistoryScreen } from '@/practice/PracticeHistoryScreen';
import { useSettingsRoutes } from '@/settings/settingsRoutes';

export default function PracticeHistoryRoute() {
  const routes = useSettingsRoutes();
  const router = useRouter();
  const openSession = useCallback(
    (uuid: string) => {
      router.push({
        pathname: TOOL_ROUTES.practiceHistory.session,
        params: { uuid },
      });
    },
    [router],
  );
  const openMetronome = useCallback(() => {
    router.push(TOOL_ROUTES.metronome.home);
  }, [router]);
  return (
    <PracticeHistoryScreen
      onBack={routes.back}
      onOpenSession={openSession}
      onOpenMetronome={openMetronome}
    />
  );
}
