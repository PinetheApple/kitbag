import {
  createThemedStyles,
  libraryList,
  lineRatio,
  screenFrameInsets,
  type ScreenFrameOptions,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useMemo } from 'react';

export interface StemDeckInsets {
  readonly top: number;
  readonly bottom: number;
}

const hint = {
  ...textStyle(textRoles.sheetHint),
  lineHeight: textRoles.sheetHint.size * lineRatio.compactBody,
};

export const useStemDeckStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  scroll: { flex: 1 },
  body: {
    flexGrow: 1,
    paddingTop: libraryList.bodyTop,
    paddingHorizontal: space.screenInset,
    gap: libraryList.bodyGap,
  },
  spacer: { flexGrow: 1 },
  hint: { ...hint, color: theme.color.text2 },
  footer: {
    ...hint,
    color: theme.color.text3,
    textAlign: 'center',
    paddingBottom: space.sectionGap,
  },
  list: { marginHorizontal: -space.screenInset },
  listNote: {
    ...hint,
    color: theme.color.text3,
    paddingVertical: space.sectionGap,
    paddingHorizontal: space.screenInset,
  },
  row: {
    minHeight: libraryList.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
    paddingLeft: space.screenInset,
    paddingRight: libraryList.rowEnd,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  rowFull: { paddingRight: space.screenInset },
  rowBody: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
  },
  tile: {
    width: libraryList.tile,
    height: libraryList.tile,
    borderRadius: libraryList.tileRadius,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: size.stroke },
  title: {
    ...textStyle(textRoles.listTitle),
    lineHeight: textRoles.listTitle.size * lineRatio.title,
    color: theme.color.text,
  },
  facts: {
    ...textStyle(textRoles.listFacts),
    lineHeight: textRoles.listFacts.size * lineRatio.compactBody,
    color: theme.color.text2,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: libraryList.badgeGap,
    flexShrink: 0,
  },
  percent: {
    ...textStyle(textRoles.statusLead),
    color: theme.color[theme.accentInk],
  },
  dock: {
    gap: space.rowGap,
    paddingTop: space.sectionGap,
    paddingHorizontal: space.screenInset,
    borderTopWidth: size.stroke,
    borderTopColor: theme.color.line,
    backgroundColor: theme.color.bg,
  },
  actions: { flexDirection: 'row', gap: space.controlGap },
  cardBody: { gap: space.chipGap, alignItems: 'flex-start' },
  cardTitle: { ...textStyle(textRoles.sheetTitle), color: theme.color.text },
  cardText: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

export function useScreenFrame<T>(
  style: T,
  insets: StemDeckInsets,
  { dockBelow = false }: ScreenFrameOptions = {},
) {
  return useMemo(
    () => [style, screenFrameInsets(insets, { dockBelow })],
    [style, insets, dockBelow],
  );
}

export function useDockInset<T>(style: T, bottomInset: number) {
  return useMemo(
    () => [style, { paddingBottom: bottomInset }],
    [style, bottomInset],
  );
}
