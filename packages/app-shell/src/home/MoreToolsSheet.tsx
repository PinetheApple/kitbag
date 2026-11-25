import { Sheet, SheetHint, ToolRow } from '@kitbag/core-design';
import { useCallback } from 'react';

import { toolStatus, type HomeToolEntry } from './registry.ts';
import { MORE_TOOLS_HINT, MORE_TOOLS_TITLE } from './subtext.ts';

export interface MoreToolsItem {
  readonly tool: HomeToolEntry;
  readonly subtitle: string;
  readonly onPress: (() => void) | undefined;
}

interface MoreToolsItemRowProps {
  readonly item: MoreToolsItem;
  readonly onDismiss: () => void;
}

function MoreToolsItemRow({ item, onDismiss }: MoreToolsItemRowProps) {
  const { tool, subtitle, onPress } = item;
  const handlePress = useCallback(() => {
    onDismiss();
    onPress?.();
  }, [onDismiss, onPress]);
  return (
    <ToolRow
      icon={tool.icon}
      title={tool.name}
      subtitle={subtitle}
      status={toolStatus(tool)}
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
  return (
    <Sheet
      visible={visible}
      title={MORE_TOOLS_TITLE}
      dismissLabel={`Close ${MORE_TOOLS_TITLE}`}
      bottomInset={bottomInset}
      onDismiss={onDismiss}
      dim
    >
      {items.map((item) => (
        <MoreToolsItemRow
          key={item.tool.id}
          item={item}
          onDismiss={onDismiss}
        />
      ))}
      <SheetHint>{MORE_TOOLS_HINT}</SheetHint>
    </Sheet>
  );
}
