import { useCallback, type ReactNode } from 'react';

import { space } from '../roles.ts';
import { SHEET_TOUCH_ROOM } from '../sheetRoom.ts';
import { unshared } from '../touchTarget.ts';
import { PickerGrid, type PickerOption } from './PickerGrid.tsx';
import { SegmentedControl, type SegmentOption } from './SegmentedControl.tsx';
import { Sheet } from './Sheet.tsx';

// Heads the sheet; the picker grid below does not reach into the gap.
const ROLE_GAPS = { bottom: unshared(space.sectionGap) };
const ROLE_EDGE = { top: SHEET_TOUCH_ROOM };

export interface SoundPickerSheetProps<R extends string> {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly hint: string;
  readonly roles: readonly SegmentOption<R>[];
  readonly role: R;
  readonly gridLabel: string;
  readonly options: readonly PickerOption<string>[];
  readonly selected: string;
  readonly children?: ReactNode;
  readonly notice?: ReactNode;
  readonly onRole: (role: R) => void;
  readonly onPick: (id: number) => void;
  readonly onDismiss: () => void;
}

export function SoundPickerSheet<R extends string>({
  visible,
  bottomInset,
  hint,
  roles,
  role,
  gridLabel,
  options,
  selected,
  children,
  notice,
  onRole,
  onPick,
  onDismiss,
}: SoundPickerSheetProps<R>) {
  const pickOption = useCallback(
    (value: string) => {
      onPick(Number(value));
    },
    [onPick],
  );
  return (
    <Sheet
      visible={visible}
      title="Click sound"
      titleIcon="sound"
      hint={hint}
      dismissLabel="Close click sound"
      bottomInset={bottomInset}
      notice={notice}
      onDismiss={onDismiss}
    >
      <SegmentedControl
        fill
        accessibilityLabel="Beat level"
        options={roles}
        selected={role}
        neighbourGapDp={ROLE_GAPS}
        edgeRoomDp={ROLE_EDGE}
        onSelect={onRole}
      />
      <PickerGrid
        accessibilityLabel={gridLabel}
        options={options}
        selected={selected}
        onSelect={pickOption}
      />
      {children}
    </Sheet>
  );
}
