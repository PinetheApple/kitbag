import { ToolRow } from '@kitbag/core-design';

import { MORE_TOOLS_TITLE, moreToolsSubtext } from './subtext.ts';

export interface MoreToolsRowProps {
  readonly count: number;
  readonly onPress: () => void;
}

export function MoreToolsRow({ count, onPress }: MoreToolsRowProps) {
  if (count === 0) return null;
  return (
    <ToolRow
      icon="moreTools"
      title={MORE_TOOLS_TITLE}
      subtitle={moreToolsSubtext(count)}
      status="ready"
      onPress={onPress}
    />
  );
}
