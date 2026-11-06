import { RestoreScreen } from '@/settings/RestoreScreen';
import { useSettingsRoutes } from '@/settings/settingsRoutes';

export default function RestoreRoute() {
  const routes = useSettingsRoutes();
  return <RestoreScreen onBack={routes.back} />;
}
