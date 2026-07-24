// Which workspace package does a file belong to? The boundary rules key off
// the on-disk path `packages/<name>/…` (SPEC §13.1). Kept in one place so the
// path convention has a single owner (SPEC §13.7).

/** True when `filename` sits inside `packages/<pkg>/` (POSIX or Windows sep). */
export function isInPackage(filename: string, pkg: string): boolean {
  const normalized = filename.replaceAll('\\', '/');
  const marker = `/packages/${pkg}/`;
  return (
    normalized.includes(marker) || normalized.startsWith(`packages/${pkg}/`)
  );
}

/** The last path segment of `filename` (POSIX or Windows sep). */
export function basename(filename: string): string {
  const normalized = filename.replaceAll('\\', '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
}
