import { inset, size } from './roles.ts';
import { unshared } from './touchTarget.ts';

// A control alone in an edit row may reach through the row's padding, which no
// other control enters; the divider beyond it is split with the next row.
export const EDIT_ROW_CONTROL_GAP = unshared(inset.editRowV) + size.stroke;
