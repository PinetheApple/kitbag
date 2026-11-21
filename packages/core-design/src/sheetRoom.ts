import { space } from './roles.ts';

// A scroll view drops touches outside its frame, so a sheet's scroll frame
// reaches this far into its padding on every side; the indicator sits there too.
export const SHEET_TOUCH_ROOM = space.sectionGap;
