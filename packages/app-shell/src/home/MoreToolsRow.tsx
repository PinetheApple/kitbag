import { ToolRow } from '@kitbag/core-design';

import { useSettingsRoutes } from '../settings/settingsRoutes.ts';
import { MORE_TOOLS_SUBTEXT, MORE_TOOLS_TITLE } from './subtext.ts';

export function MoreToolsRow() {
  const { openTools } = useSettingsRoutes();
  return (
    <ToolRow
      icon="moreTools"
      title={MORE_TOOLS_TITLE}
      subtitle={MORE_TOOLS_SUBTEXT}
      status="ready"
      onPress={openTools}
    />
  );
}
