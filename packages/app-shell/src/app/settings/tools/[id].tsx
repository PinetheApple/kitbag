import { useLocalSearchParams } from 'expo-router';

import { TOOL_PARAM, useSettingsRoutes } from '@/settings/settingsRoutes';
import { ToolPageScreen } from '@/settings/ToolPageScreen';

export default function ToolPageRoute() {
  const routes = useSettingsRoutes();
  const params = useLocalSearchParams<Record<typeof TOOL_PARAM, string>>();
  return (
    <ToolPageScreen
      toolId={params[TOOL_PARAM]}
      onBack={routes.back}
      onOptIn={routes.openToolDownloads}
      onRemoved={routes.toolRemoved}
    />
  );
}
