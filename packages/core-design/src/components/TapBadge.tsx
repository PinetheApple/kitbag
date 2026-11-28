import { Badge } from './Badge.tsx';

export interface TapBadgeProps {
  readonly label: string;
  readonly ignored?: boolean;
}

export function TapBadge({ label, ignored = false }: TapBadgeProps) {
  return <Badge label={label} tone={ignored ? 'warning' : 'default'} />;
}
