import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { LedRowLayout } from '../logic/ledLayout.ts';
import { useBeatDotStyles } from './beatDotStyles.ts';

export interface Edge {
  readonly first: boolean;
  readonly last: boolean;
}

export interface BeatPosition {
  readonly line: Edge;
  readonly group: Edge;
  readonly dot: Edge;
}

const edge = (index: number, count: number): Edge => ({
  first: index === 0,
  last: index === count - 1,
});

interface BeatGridProps {
  readonly lines: readonly LedRowLayout[];
  readonly renderBeat: (beat: number, position: BeatPosition) => ReactNode;
}

export function BeatGrid({ lines, renderBeat }: BeatGridProps) {
  const styles = useBeatDotStyles();
  return lines.map((line, lineIndex) => (
    <View key={lineIndex} style={styles.line}>
      {line.map((group, groupIndex) => (
        <View key={groupIndex} style={styles.group}>
          {group.map((beat, dotIndex) => (
            <View key={beat} style={styles.beat}>
              {renderBeat(beat, {
                line: edge(lineIndex, lines.length),
                group: edge(groupIndex, line.length),
                dot: edge(dotIndex, group.length),
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  ));
}
