import { useSettingsRoutes } from '@/settings/settingsRoutes';
import { AttributionsScreen } from '@/settings/AttributionsScreen';

export default function AttributionsRoute() {
  const routes = useSettingsRoutes();
  return <AttributionsScreen onBack={routes.back} />;
}
