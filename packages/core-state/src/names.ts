export function cleanName(raw: string): string | null {
  const name = raw.trim();
  return name === '' ? null : name;
}
