export interface SourceCredit {
  readonly name: string;
  readonly url: string;
}

export function creditLinkText({ url }: Pick<SourceCredit, 'url'>): string {
  return url.replace(/^https?:\/\//, '');
}
