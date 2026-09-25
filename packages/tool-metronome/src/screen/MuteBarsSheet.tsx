import {
  Button,
  createThemedStyles,
  opacity,
  radius,
  Sheet,
  SheetHint,
  size,
  space,
  StepControl,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { Text, View } from 'react-native';

import { useBarMuteEditor, type BarMuteEditor } from './useBarMuteEditor.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  label: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
  },
  preview: {
    flexDirection: 'row',
    gap: space.barPreviewGap,
  },
  bar: {
    flex: 1,
    height: size.barPreview,
    borderRadius: radius.barPreview,
  },
  sounding: {
    backgroundColor: theme.color.accent,
    opacity: opacity.barPreviewSounding,
  },
  silent: {
    backgroundColor: theme.color.surface3,
  },
  actions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));

const bars = (count: number) =>
  `${String(count)} ${count === 1 ? 'bar' : 'bars'}`;

function MuteSteppers({ editor }: { readonly editor: BarMuteEditor }) {
  const styles = useStyles();
  const { playBars, muteBars } = editor.barMute;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Play</Text>
      <StepControl
        variant="inline"
        label="Bars to play"
        value={String(playBars)}
        accessibilityValue={bars(playBars)}
        onStep={editor.stepPlay}
      />
      <Text style={styles.label}>then mute</Text>
      <StepControl
        variant="inline"
        label="Bars to mute"
        value={String(muteBars)}
        accessibilityValue={bars(muteBars)}
        onStep={editor.stepMute}
      />
    </View>
  );
}

function MutePreview({ preview }: { readonly preview: readonly boolean[] }) {
  const styles = useStyles();
  const spoken = preview
    .map((sounding) => (sounding ? 'play' : 'mute'))
    .join(', ');
  return (
    <View
      accessible
      accessibilityLabel={`Eight bars of the cycle: ${spoken}`}
      style={styles.preview}
    >
      {preview.map((sounding, bar) => (
        <View
          key={bar}
          style={[styles.bar, sounding ? styles.sounding : styles.silent]}
        />
      ))}
    </View>
  );
}

function MuteActions({ editor }: { readonly editor: BarMuteEditor }) {
  const styles = useStyles();
  return (
    <View style={styles.actions}>
      <Button
        fill
        variant="ghost"
        label="Off"
        disabled={!editor.barMute.enabled}
        onPress={editor.turnOff}
      />
      <Button fill variant="primary" label="Apply" onPress={editor.apply} />
    </View>
  );
}

interface MuteBarsSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MuteBarsSheet({
  visible,
  bottomInset,
  onDismiss,
}: MuteBarsSheetProps) {
  const editor = useBarMuteEditor(onDismiss);
  return (
    <Sheet
      visible={visible}
      title="Mute bars"
      titleIcon="muteBars"
      dismissLabel="Close mute bars"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <MuteSteppers editor={editor} />
      <MutePreview preview={editor.preview} />
      <SheetHint>
        Preview shows eight bars of the cycle. Silent bars still light the LEDs
        — you keep the visual, lose the click.
      </SheetHint>
      <MuteActions editor={editor} />
    </Sheet>
  );
}
