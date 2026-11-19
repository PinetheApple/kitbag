import {
  createThemedStyles,
  minTouchTargetDp,
  DesignFloorOneLineText,
  Icon,
  stemPlayer,
  StepControl,
  textRoles,
  textStyle,
  type StepDelta,
} from '@kitbag/core-design';
import { steppedKey, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import {
  isSetApart,
  keyText,
  spokenKey,
  stemKeyStatus,
} from '../logic/speedKeyView.ts';
import { stemNameWidth } from '../logic/stemName.ts';

const STEPPER_GAPS = { top: 0, bottom: 0 };

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.rowGap,
    minHeight: minTouchTargetDp,
  },
  name: { ...textStyle(textRoles.stemName), color: theme.color.text },
  nameFixed: { color: theme.color.text2 },
  status: {
    ...textStyle(textRoles.hint),
    color: theme.color.text3,
    flex: 1,
  },
  statusApart: { color: theme.color[theme.accentInk] },
  restore: {
    width: minTouchTargetDp,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

function StemKeyRow({ index }: { readonly index: number }) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const nameBox = useMemo(
    () => ({ width: stemNameWidth(fontScale) }),
    [fontScale],
  );
  const row = useStemPlayer((s) => s.stems[index]);
  const songKey = useStemPlayer((s) => s.songKey);
  const setStemKey = useStemPlayer((s) => s.setStemKey);
  const key = row?.key ?? songKey;
  const step = useCallback(
    (delta: StepDelta) => {
      void setStemKey(index, steppedKey(key, delta));
    },
    [setStemKey, index, key],
  );
  const restore = useCallback(() => {
    void setStemKey(index, songKey);
  }, [setStemKey, index, songKey]);
  if (row === undefined) return null;
  const apart = isSetApart(row, songKey);
  return (
    <View style={styles.row}>
      <DesignFloorOneLineText
        text={row.name}
        role={textRoles.stemName}
        style={[styles.name, !row.transposable && styles.nameFixed]}
        boxStyle={nameBox}
      />
      <Text style={[styles.status, apart && styles.statusApart]}>
        {stemKeyStatus(row, songKey)}
      </Text>
      {row.transposable ? (
        <StepControl
          variant="inlineLarge"
          label={`${row.name} key`}
          value={keyText(row.key)}
          accessibilityValue={spokenKey(row.key)}
          accented={apart}
          neighbourGapDp={STEPPER_GAPS}
          onStep={step}
        />
      ) : null}
      {apart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Set ${row.name} back to the song key`}
          style={styles.restore}
          onPress={restore}
        >
          <Icon name="reset" size="title" color="text2" />
        </Pressable>
      ) : (
        <View style={styles.restore} />
      )}
    </View>
  );
}

export function StemKeyRows() {
  const count = useStemPlayer((s) => s.stems.length);
  const indexes = useMemo(
    () => Array.from({ length: count }, (_, i) => i),
    [count],
  );
  return (
    <>
      {indexes.map((index) => (
        <StemKeyRow key={index} index={index} />
      ))}
    </>
  );
}
