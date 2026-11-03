import { inset, size } from './roles.ts';
import { unshared } from './touchTarget.ts';

export const EDIT_ROW_PRESSABLE_GAP = inset.editRowV + size.stroke;

// The divider below is split with the next row.
export const EDIT_ROW_CONTROL_GAP = unshared(inset.editRowV) + size.stroke;
