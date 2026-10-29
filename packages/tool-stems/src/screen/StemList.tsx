import { createThemedStyles, size, stemPlayer } from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { GainFader } from './GainFader.tsx';
import { LevelChip } from './LevelChip.tsx';
import { StemRowView } from './StemRowView.tsx';
import { useStemStyles } from './stemStyles.ts';

const MASTER = 'master';
type Expanded = number | typeof MASTER | null;

const useStyles = createThemedStyles((theme) => ({
  card: {
    flexShrink: 1,
    backgroundColor: theme.color.surface1,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    borderRadius: stemPlayer.listRadius,
    overflow: 'hidden',
  },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: stemPlayer.listH },
  grow: { flex: 1 },
  toggleRoom: { width: stemPlayer.toggle * 2 + stemPlayer.rowGap },
}));

function MasterRow({
  expanded,
  onExpand,
}: {
  readonly expanded: boolean;
  readonly onExpand: () => void;
}) {
  const styles = useStyles();
  const stemStyles = useStemStyles();
  const gain = useStemPlayer((s) => s.masterGain);
  const setMasterGain = useStemPlayer((s) => s.setMasterGain);
  return (
    <View style={expanded ? stemStyles.expanded : stemStyles.rowFrame}>
      <View
        style={[
          stemStyles.row,
          expanded ? stemStyles.rowExpanded : stemStyles.rowMaster,
        ]}
      >
        <Text style={[stemStyles.name, stemStyles.nameMaster, styles.grow]}>
          Master
        </Text>
        <LevelChip
          label="Master"
          gain={gain}
          open={expanded}
          onPress={onExpand}
        />
        <View style={styles.toggleRoom} />
      </View>
      {expanded ? (
        <GainFader label="Master" gain={gain} onGain={setMasterGain} />
      ) : null}
    </View>
  );
}

export function StemList({
  progress,
}: {
  readonly progress: SharedValue<number>;
}) {
  const styles = useStyles();
  const count = useStemPlayer((s) => s.stems.length);
  const [expanded, setExpanded] = useState<Expanded>(null);
  const expand = useCallback((key: number) => {
    setExpanded((open) => (open === key ? null : key));
  }, []);
  const expandMaster = useCallback(() => {
    setExpanded((open) => (open === MASTER ? null : MASTER));
  }, []);
  const indexes = useMemo(
    () => Array.from({ length: count }, (_, i) => i),
    [count],
  );
  return (
    <View style={styles.card}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {indexes.map((index) => (
          <StemRowView
            key={index}
            index={index}
            progress={progress}
            expanded={expanded === index}
            onExpand={expand}
          />
        ))}
        <MasterRow expanded={expanded === MASTER} onExpand={expandMaster} />
      </ScrollView>
    </View>
  );
}
