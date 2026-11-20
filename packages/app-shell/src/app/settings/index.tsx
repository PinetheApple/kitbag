import { useLocalSearchParams } from 'expo-router';

import {
  DATA_FOLDER_SHEET,
  SHEET_PARAM,
  useSettingsRoutes,
} from '@/settings/settingsRoutes';
import { SettingsScreen } from '@/settings/SettingsScreen';

export default function SettingsRoute() {
  const routes = useSettingsRoutes();
  const params = useLocalSearchParams<Record<typeof SHEET_PARAM, string>>();
  return (
    <SettingsScreen
      openDataFolder={params[SHEET_PARAM] === DATA_FOLDER_SHEET}
      onBack={routes.back}
      onOpenAttributions={routes.openAttributions}
      onOpenCalibration={routes.openCalibration}
      onOpenTools={routes.openTools}
      onOpenRestore={routes.openRestore}
      onOpenPractice={routes.openPractice}
    />
  );
}
