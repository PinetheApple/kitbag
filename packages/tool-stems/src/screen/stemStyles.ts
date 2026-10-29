import {
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  size,
  stemPlayer,
  stemPlayerMix,
  textRoles,
  textStyle,
  unshared,
  withAlpha,
} from '@kitbag/core-design';

const ROW_ROOM = stemPlayer.expandedRowHeight;
const ROW_END = stemPlayer.rowEndH + stemPlayer.listH;

export const LEVEL_HIT_BOX = hitBoxStyle(
  hitExtension(stemPlayer.levelMinWidth, stemPlayer.levelHeight, {
    top: ROW_ROOM - stemPlayer.levelHeight,
    bottom: ROW_ROOM - stemPlayer.levelHeight,
    left: stemPlayer.rowGap,
    right: stemPlayer.rowGap,
  }),
);

export const MUTE_HIT_BOX = hitBoxStyle(
  hitExtension(stemPlayer.toggle, stemPlayer.toggle, {
    top: ROW_ROOM - stemPlayer.toggle,
    bottom: ROW_ROOM - stemPlayer.toggle,
    left: stemPlayer.rowGap,
    right: stemPlayer.rowGap,
  }),
);

export const SOLO_HIT_BOX = hitBoxStyle(
  hitExtension(stemPlayer.toggle, stemPlayer.toggle, {
    top: ROW_ROOM - stemPlayer.toggle,
    bottom: ROW_ROOM - stemPlayer.toggle,
    left: stemPlayer.rowGap,
    right: unshared(ROW_END),
  }),
);

export const useStemStyles = createThemedStyles((theme) => ({
  rowFrame: { height: stemPlayer.rowHeight },
  divider: {
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  expanded: {
    backgroundColor: withAlpha(theme.color.accent, stemPlayerMix.expandedRow),
    marginHorizontal: -stemPlayer.listH,
    paddingHorizontal: stemPlayer.listH,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.rowGap,
    paddingRight: stemPlayer.rowEndH,
  },
  rowCollapsed: { height: stemPlayer.rowHeight - size.stroke },
  rowExpanded: { height: stemPlayer.expandedRowHeight },
  rowMaster: { height: stemPlayer.rowHeight },
  name: {
    ...textStyle(textRoles.stemName),
    color: theme.color.text,
    width: stemPlayer.nameWidth,
  },
  nameQuiet: { color: theme.color.text3 },
  nameMaster: { color: theme.color.text2 },
  level: {
    minHeight: stemPlayer.levelHeight,
    minWidth: stemPlayer.levelMinWidth,
    paddingHorizontal: stemPlayer.levelH,
    borderRadius: stemPlayer.levelRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelOpen: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  levelText: {
    ...textStyle(textRoles.stemLevel),
    color: theme.color.text2,
  },
  levelSizer: { opacity: 0 },
  levelShown: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  levelTextZero: { color: theme.color.text3 },
  levelTextOpen: { color: theme.color.accent },
}));
