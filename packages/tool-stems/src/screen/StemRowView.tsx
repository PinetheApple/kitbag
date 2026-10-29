import {
  createThemedStyles,
  opacity,
  stemPlayer,
  stemPlayerMix,
  Waveform,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { GainFader } from './GainFader.tsx';
import { LevelChip } from './LevelChip.tsx';
import { StemNameEditor } from './StemNameEditor.tsx';
import { StemToggle } from './StemToggle.tsx';
import { useStemStyles } from './stemStyles.ts';

export const WAVEFORM_BARS = 26;

const useStyles = createThemedStyles(() => ({
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.rowGap,
    alignSelf: 'stretch',
  },
  nameHit: { alignSelf: 'stretch', justifyContent: 'center' },
  wave: { flex: 1, opacity: stemPlayerMix.wave },
  waveQuiet: { opacity: stemPlayerMix.mutedWave },
  missing: { opacity: opacity.muted },
}));

interface StemRowViewProps {
  readonly index: number;
  readonly progress: SharedValue<number>;
  readonly expanded: boolean;
  readonly onExpand: (index: number) => void;
}

export function StemRowView({
  index,
  progress,
  expanded,
  onExpand,
}: StemRowViewProps) {
  const styles = useStyles();
  const stemStyles = useStemStyles();
  const row = useStemPlayer((s) => s.stems[index]);
  const setGain = useStemPlayer((s) => s.setGain);
  const toggleMute = useStemPlayer((s) => s.toggleMute);
  const solo = useStemPlayer((s) => s.solo);
  const renameStem = useStemPlayer((s) => s.renameStem);
  const [editing, setEditing] = useState(false);
  const startRename = useCallback(() => {
    setEditing(true);
  }, []);
  const finishRename = useCallback(
    (name: string) => {
      setEditing(false);
      void renameStem(index, name);
    },
    [renameStem, index],
  );
  const expand = useCallback(() => {
    onExpand(index);
  }, [onExpand, index]);
  const mute = useCallback(() => {
    toggleMute(index);
  }, [toggleMute, index]);
  const soloAlone = useCallback(() => {
    solo(index, false);
  }, [solo, index]);
  const soloAdd = useCallback(() => {
    solo(index, true);
  }, [solo, index]);
  const gain = useCallback(
    (value: number) => {
      setGain(index, value);
    },
    [setGain, index],
  );
  if (row === undefined) return null;
  return (
    <View
      style={[
        expanded ? stemStyles.expanded : stemStyles.rowFrame,
        stemStyles.divider,
        !row.loaded && styles.missing,
      ]}
    >
      <View
        style={[
          stemStyles.row,
          expanded ? stemStyles.rowExpanded : stemStyles.rowCollapsed,
        ]}
      >
        {editing ? (
          <StemNameEditor name={row.name} onDone={finishRename} />
        ) : (
          <Pressable
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.open}
            onPress={expand}
          >
            <Pressable
              style={styles.nameHit}
              onPress={expand}
              onLongPress={startRename}
            >
              <Text
                style={[stemStyles.name, row.muted && stemStyles.nameQuiet]}
                numberOfLines={1}
              >
                {row.name}
              </Text>
            </Pressable>
            <View style={[styles.wave, row.muted && styles.waveQuiet]}>
              <Waveform
                envelope={row.envelope}
                bars={WAVEFORM_BARS}
                height={stemPlayer.waveHeight}
                progress={progress}
                extent={row.extent}
              />
            </View>
          </Pressable>
        )}
        <LevelChip
          label={row.name}
          gain={row.volume}
          open={expanded}
          onPress={expand}
          onRename={startRename}
        />
        <StemToggle
          kind="mute"
          on={row.muted}
          label={`Mute ${row.name}`}
          onPress={mute}
        />
        <StemToggle
          kind="solo"
          on={row.soloed}
          label={`Solo ${row.name}; hold to add to the solo`}
          onPress={soloAlone}
          onLongPress={soloAdd}
        />
      </View>
      {expanded ? (
        <GainFader label={row.name} gain={row.volume} onGain={gain} />
      ) : null}
    </View>
  );
}
