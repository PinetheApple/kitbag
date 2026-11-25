import {
  Sheet,
  SheetHint,
  ToolRow,
  useAfterSheetClosed,
} from '@kitbag/core-design';
import { useCallback } from 'react';

import type { BuiltTool } from './registry.ts';
import { MORE_TOOLS_HINT, MORE_TOOLS_TITLE } from './subtext.ts';

export interface MoreToolsItem {
  readonly tool: BuiltTool;
  readonly subtitle: string;
  readonly onPress: () => void;
}

interface MoreToolsItemRowProps {
  readonly item: MoreToolsItem;
  readonly onPress: (open: () => void) => void;
}

function MoreToolsItemRow({ item, onPress }: MoreToolsItemRowProps) {
  const { tool, subtitle } = item;
  const handlePress = useCallback(() => {
    onPress(item.onPress);
  }, [onPress, item.onPress]);
  return (
    <ToolRow
      icon={tool.icon}
      title={tool.name}
      subtitle={subtitle}
      status="ready"
      onPress={handlePress}
    />
  );
}

export interface MoreToolsSheetProps {
  readonly visible: boolean;
  readonly items: readonly MoreToolsItem[];
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MoreToolsSheet({
  visible,
  items,
  bottomInset,
  onDismiss,
}: MoreToolsSheetProps) {
  const { after, closed } = useAfterSheetClosed(visible);
  const openAfterClose = useCallback(
    (open: () => void) => {
      onDismiss();
      after(open);
    },
    [onDismiss, after],
  );
  return (
    <Sheet
      visible={visible}
      title={MORE_TOOLS_TITLE}
      dismissLabel={`Close ${MORE_TOOLS_TITLE}`}
      bottomInset={bottomInset}
      onDismiss={onDismiss}
      onClosed={closed}
      dim
    >
      {items.map((item) => (
        <MoreToolsItemRow
          key={item.tool.id}
          item={item}
          onPress={openAfterClose}
        />
      ))}
      <SheetHint>{MORE_TOOLS_HINT}</SheetHint>
    </Sheet>
  );
}
