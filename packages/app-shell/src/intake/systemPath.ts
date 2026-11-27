const SYSTEM_FILE_SCHEMES: readonly string[] = ['content', 'file'];
const SCHEME_END = ':';
const HOME = '/';
const STAY = '';

export interface SystemPath {
  readonly path: string;
  readonly initial: boolean;
}

// An opened file is the intake's to route; as a link it would land on an unmatched screen.
export function redirectSystemPath({ path, initial }: SystemPath): string {
  const end = path.indexOf(SCHEME_END);
  const scheme = end < 0 ? '' : path.slice(0, end).toLowerCase();
  if (!SYSTEM_FILE_SCHEMES.includes(scheme)) return path;
  return initial ? HOME : STAY;
}
