export interface DataNode {
  readonly kind?: string;
  readonly role?: string;
  readonly label?: string;
  readonly px?: number;
  readonly lines?: number;
  readonly ellipsis?: string;
  readonly a11y?: string;
  readonly measures?: boolean;
  readonly style?: Readonly<Record<string, unknown>>;
  readonly at: number;
}

const QUOT = /&quot;/g;
const AMP = /&amp;/g;

export function dataNodes(markup: string): DataNode[] {
  return [...markup.matchAll(/data-node="([^"]*)"/g)].map((match) => ({
    ...(JSON.parse(
      (match[1] ?? '{}').replace(QUOT, '"').replace(AMP, '&'),
    ) as Omit<DataNode, 'at'>),
    at: match.index,
  }));
}
