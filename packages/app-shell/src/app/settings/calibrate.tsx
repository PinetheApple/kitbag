import { CalibrationScreen } from '@/settings/CalibrationScreen';
import { useSettingsRoutes } from '@/settings/settingsRoutes';

export default function CalibrateRoute() {
  const routes = useSettingsRoutes();
  return <CalibrationScreen onBack={routes.back} />;
}
