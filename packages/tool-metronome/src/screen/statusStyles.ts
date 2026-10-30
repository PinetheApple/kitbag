import {
  createThemedStyles,
  metronome,
  metronomeMix,
  mixHex,
  radius,
  size,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';

const LIVE_ROWS = 2;

export function countInInk(bg: string, text: string): string {
  return mixHex(bg, text, metronomeMix.countInMeta);
}

export const useStatusStyles = createThemedStyles((theme) => ({
  stack: {
    height: metronome.statusLine * LIVE_ROWS + metronome.statusRowGap,
  },
  variant: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: metronome.statusLine,
  },
  rest: {
    height: metronome.statusLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.controlGap,
  },
  restText: {
    ...textStyle(textRoles.status),
    color: theme.color.text2,
    flexShrink: 1,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    paddingHorizontal: metronome.statusH,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
    overflow: 'hidden',
  },
  reached: {
    borderColor: theme.color.accentDim,
  },
  afterCountIn: {
    backgroundColor: TRANSPARENT,
    borderStyle: 'dashed',
  },
  afterCountInText: {
    color: theme.color.text2,
  },
  countIn: {
    backgroundColor: theme.color.text,
    borderColor: theme.color.text,
  },
  lead: {
    ...textStyle(textRoles.statusLead),
    color: theme.color.text,
  },
  countInLead: {
    color: theme.color.bg,
  },
  detail: {
    ...textStyle(textRoles.status),
    color: theme.color.text,
    flex: 1,
  },
  meta: {
    ...textStyle(textRoles.statusMeta),
    color: theme.color.text2,
  },
  pushRight: {
    marginLeft: 'auto',
  },
  metaGap: {
    marginLeft: metronome.statusMetaGap,
  },
  countInMeta: {
    color: countInInk(theme.color.bg, theme.color.text),
  },
  ghost: {
    opacity: 0,
  },
  slotFill: {
    width: '100%',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: metronome.statusProgress,
  },
  progress: {
    height: metronome.statusProgress,
    backgroundColor: theme.color.accent,
    transformOrigin: 'left',
  },
}));
