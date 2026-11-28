export function toolGlobalPrefix(id: string): string {
  return `__kbt_${id.replaceAll('-', '_')}_`;
}
