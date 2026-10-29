import {
  createThemedStyles,
  inset,
  mix,
  mixHex,
  radius,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';

export const useStatusStyles = createThemedStyles((theme) => ({
  line: {
    height: size.statusLine,
  },
  variant: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  rest: {
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
    paddingHorizontal: inset.statusH,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
    overflow: 'hidden',
  },
  reached: {
    borderColor: theme.color.accentDim,
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
    marginLeft: space.statusMetaGap,
  },
  countInMeta: {
    color: mixHex(theme.color.bg, theme.color.text, mix.countInMeta),
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
    height: size.statusProgress,
  },
  progress: {
    height: size.statusProgress,
    backgroundColor: theme.color.accent,
    transformOrigin: 'left',
  },
}));

export function countInIconColor(bg: string, text: string): string {
  return mixHex(bg, text, mix.countInMeta);
}
