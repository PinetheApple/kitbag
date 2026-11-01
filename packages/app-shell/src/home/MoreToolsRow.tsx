import { ToolRow } from '@kitbag/core-design';

import { useSettingsRoutes } from '../settings/settingsRoutes.ts';

export function MoreToolsRow() {
  const { openTools } = useSettingsRoutes();
  return (
    <ToolRow
      icon="moreTools"
      title="More tools"
      subtitle="Future tools arrive as plugins"
      status="ready"
      onPress={openTools}
    />
  );
}
