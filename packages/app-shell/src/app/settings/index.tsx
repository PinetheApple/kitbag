import { useSettingsRoutes } from '@/settings/settingsRoutes';
import { SettingsScreen } from '@/settings/SettingsScreen';

export default function SettingsRoute() {
  const routes = useSettingsRoutes();
  return (
    <SettingsScreen
      onBack={routes.back}
      onOpenAttributions={routes.openAttributions}
    />
  );
}
