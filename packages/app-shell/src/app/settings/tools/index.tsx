import { useLocalSearchParams } from 'expo-router';

import { REMOVED_PARAM, useSettingsRoutes } from '@/settings/settingsRoutes';
import { ToolsScreen } from '@/settings/ToolsScreen';

export default function ToolsRoute() {
  const routes = useSettingsRoutes();
  const params =
    useLocalSearchParams<Partial<Record<typeof REMOVED_PARAM, string>>>();
  return (
    <ToolsScreen
      onBack={routes.back}
      onOpenTool={routes.openToolPage}
      onOpenOptIn={routes.openToolDownloads}
      removedToolId={params[REMOVED_PARAM]}
    />
  );
}
