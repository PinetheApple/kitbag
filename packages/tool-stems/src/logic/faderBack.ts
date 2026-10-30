export function collapseFaderOnBack(
  open: boolean,
  collapse: () => void,
): boolean {
  if (!open) return false;
  collapse();
  return true;
}
