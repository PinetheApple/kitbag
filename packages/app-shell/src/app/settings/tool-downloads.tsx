import { useLocalSearchParams } from 'expo-router';

import { TOOL_PARAM, useSettingsRoutes } from '@/settings/settingsRoutes';
import { ToolDownloadsOptInScreen } from '@/settings/ToolDownloadsOptInScreen';

export default function ToolDownloadsRoute() {
  const routes = useSettingsRoutes();
  const params =
    useLocalSearchParams<Partial<Record<typeof TOOL_PARAM, string>>>();
  return (
    <ToolDownloadsOptInScreen
      toolId={params[TOOL_PARAM]}
      onBack={routes.back}
    />
  );
}
