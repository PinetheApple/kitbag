import {
  bodyLineHeight,
  createThemedStyles,
  lineRatio,
  size,
  space,
  textRoles,
  textStyle,
  toolsManager,
} from '@kitbag/core-design';

export const useToolScreenStyles = createThemedStyles((theme) => ({
  body: {
    ...textStyle(textRoles.fieldLabel),
    lineHeight: textRoles.fieldLabel.size * bodyLineHeight,
    color: theme.color.text2,
    paddingHorizontal: toolsManager.introH,
  },
  hint: {
    ...textStyle(textRoles.sheetHint),
    lineHeight: textRoles.sheetHint.size * lineRatio.hint,
    color: theme.color.text2,
    paddingHorizontal: toolsManager.introH,
  },
  dock: {
    paddingTop: space.sectionGap,
    paddingHorizontal: space.screenInset,
    paddingBottom: space.screenInset,
    gap: space.controlGap,
    backgroundColor: theme.color.bg,
    borderTopWidth: size.stroke,
    borderTopColor: theme.color.line,
  },
  actions: { flexDirection: 'row', gap: space.controlGap },
}));
