import {
  createThemedStyles,
  metronome,
  space,
  textRoles,
  textStyle,
  withAlpha,
} from '@kitbag/core-design';
import { Platform } from 'react-native';

const FADED_OUT = 0;

export const useMetronomeScreenStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: space.screenInset,
  },
  readerLayer: {
    flex: 1,
  },
  snackbarLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
  },
  // A ScrollView clips its content; the poly row's last pulse and cycle
  // bracket hang past the content edge into the screen inset.
  bodyClip: {
    flex: 1,
    marginHorizontal: -space.screenInset,
    overflow: 'hidden',
  },
  body: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bodyContent: {
    flexGrow: 1,
    paddingHorizontal: space.screenInset,
  },
  tempoBlock: {
    paddingTop: metronome.belowAppBar,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: metronome.scrollFade,
    pointerEvents: 'none',
    ...(Platform.OS === 'web'
      ? { backgroundColor: theme.color.bg }
      : {
          experimental_backgroundImage: `linear-gradient(to top, ${theme.color.bg}, ${withAlpha(theme.color.bg, FADED_OUT)})`,
        }),
  },
  notes: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
    textAlign: 'center',
  },
  legend: {
    marginTop: metronome.legendTop,
    minHeight: metronome.legendRow,
    justifyContent: 'center',
  },
  toolsPush: {
    flexGrow: 1,
  },
}));
