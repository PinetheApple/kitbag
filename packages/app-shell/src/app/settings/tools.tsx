import { useSettingsRoutes } from '@/settings/settingsRoutes';
import { ToolsScreen } from '@/settings/ToolsScreen';

export default function ToolsRoute() {
  const routes = useSettingsRoutes();
  return <ToolsScreen onBack={routes.back} />;
}
