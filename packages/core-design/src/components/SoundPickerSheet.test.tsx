import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SHEET_TOUCH_ROOM } from '../sheetRoom.ts';
import { SoundPickerSheet } from './SoundPickerSheet.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const seen = vi.hoisted(() => ({
  roles: null as Props | null,
  grid: null as Props | null,
}));

vi.mock('./Sheet.tsx', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: (props: Props) => h('section', null, props.children) };
});
vi.mock('./SegmentedControl.tsx', () => ({
  SegmentedControl: (props: Props) => {
    seen.roles = props;
    return null;
  },
}));
vi.mock('./PickerGrid.tsx', () => ({
  PickerGrid: (props: Props) => {
    seen.grid = props;
    return null;
  },
}));

const onPick = vi.fn();
const onRole = vi.fn();

function render() {
  renderToStaticMarkup(
    <SoundPickerSheet
      visible
      bottomInset={0}
      hint="Hint"
      roles={[
        { value: 'normal', label: 'Normal' },
        { value: 'accent', label: 'Accent' },
      ]}
      role="accent"
      gridLabel="Accent beat sound"
      options={[{ value: '1', label: 'Woodblock' }]}
      selected="1"
      onRole={onRole}
      onPick={onPick}
      onDismiss={vi.fn()}
    >
      <i data-custom />
    </SoundPickerSheet>,
  );
}

describe('the beat level control heading the sound sheet', () => {
  it('takes the room to the sheet edge above it whole', () => {
    render();
    expect(seen.roles?.edgeRoomDp).toEqual({ top: SHEET_TOUCH_ROOM });
    expect(
      (seen.roles?.neighbourGapDp as { top?: number }).top,
    ).toBeUndefined();
  });

  it('switches the role and picks a sound id from the grid for it', () => {
    render();
    expect(seen.roles?.selected).toBe('accent');
    expect(seen.roles?.onSelect).toBe(onRole);
    expect(seen.grid?.accessibilityLabel).toBe('Accent beat sound');
    (seen.grid?.onSelect as (value: string) => void)('1');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(1);
  });
});
