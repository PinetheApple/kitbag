import {
  bodyLineHeight,
  Button,
  createThemedStyles,
  homeArrange,
  homeArrangeText,
  Sheet,
  useDragGroup,
  textStyle,
} from '@kitbag/core-design';
import { hiddenTiles, showTile, visibleTiles } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { ArrangeRow, RowLabel, useArrangeRowStyles } from './ArrangeRow.tsx';
import { toolFor, type HomeArrangement, type HomeTile } from './arrangement.ts';
import type { HomeToolEntry } from './registry.ts';

const useStyles = createThemedStyles((theme) => ({
  body: {
    gap: homeArrange.rowGap,
  },
  hint: {
    ...textStyle(homeArrangeText.hint),
    lineHeight: homeArrangeText.hint.size * homeArrange.hintLine,
    color: theme.color.text2,
  },
  section: {
    ...textStyle(homeArrangeText.section),
    lineHeight: homeArrangeText.section.size * bodyLineHeight,
    marginTop: homeArrange.sectionTop,
    color: theme.color.text2,
  },
}));

interface HiddenRowProps {
  readonly tile: HomeTile;
  readonly tool: HomeToolEntry;
  readonly arrangement: HomeArrangement;
  readonly onArrange: (next: HomeArrangement) => void;
}

function HiddenRow({ tile, tool, arrangement, onArrange }: HiddenRowProps) {
  const styles = useArrangeRowStyles();
  const handleShow = useCallback(() => {
    onArrange(showTile(arrangement, tile.toolId));
  }, [arrangement, tile.toolId, onArrange]);
  return (
    <View style={[styles.row, styles.hiddenRow]}>
      <View style={styles.handle} />
      <RowLabel
        tile={tile}
        tool={tool}
        spoken={`${tool.name}, hidden`}
        arrangement={arrangement}
        onArrange={onArrange}
      />
      <Button
        variant="tonal"
        size="small"
        icon="show"
        iconSize="field"
        iconTone="accent"
        label="Show"
        accessibilityLabel={`Show ${tool.name}`}
        onPress={handleShow}
      />
    </View>
  );
}

function withTool(tile: HomeTile) {
  const tool = toolFor(tile);
  return tool === undefined ? [] : [{ tile, tool }];
}

export interface ArrangeSheetProps {
  readonly visible: boolean;
  readonly arrangement: HomeArrangement;
  readonly bottomInset: number;
  readonly onArrange: (next: HomeArrangement) => void;
  readonly onDone: () => void;
}

export function ArrangeSheet({
  visible,
  arrangement,
  bottomInset,
  onArrange,
  onDone,
}: ArrangeSheetProps) {
  const styles = useStyles();
  const [dragging, setDragging] = useState(false);
  const group = useDragGroup(arrangement);
  const shown = visibleTiles(arrangement).flatMap(withTool);
  const hidden = hiddenTiles(arrangement).flatMap(withTool);
  return (
    <Sheet
      visible={visible}
      title="Arrange Home"
      titleSize="screen"
      titleAction={
        <Button
          variant="primary"
          size="small"
          icon="confirm"
          iconSize="field"
          label="Done"
          onPress={onDone}
        />
      }
      dismissLabel="Close Arrange Home"
      bottomInset={bottomInset}
      onDismiss={onDone}
      dim
      scrollEnabled={!dragging}
    >
      <View style={styles.body}>
        <Text style={styles.hint}>
          Drag the handle to reorder. Tiles fill left to right, top to bottom.
        </Text>
        {shown.map(({ tile, tool }, index) => (
          <ArrangeRow
            key={tile.toolId}
            tile={tile}
            tool={tool}
            index={index}
            count={shown.length}
            arrangement={arrangement}
            onArrange={onArrange}
            onDragActive={setDragging}
            group={group}
          />
        ))}
        <Text accessibilityRole="header" style={styles.section}>
          {hidden.length === 0 ? 'Hidden' : `Hidden · ${String(hidden.length)}`}
        </Text>
        {hidden.length === 0 ? (
          <Text style={styles.hint}>Nothing hidden.</Text>
        ) : (
          hidden.map(({ tile, tool }) => (
            <HiddenRow
              key={tile.toolId}
              tile={tile}
              tool={tool}
              arrangement={arrangement}
              onArrange={onArrange}
            />
          ))
        )}
      </View>
    </Sheet>
  );
}
