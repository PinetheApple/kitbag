import type { ColorToken } from '../tokens.ts';
import { useTheme } from '../ThemeProvider.tsx';
import { sameWidthFigures, type PlainRoleName } from './drawnText.ts';
import { DrawnTextFrame } from './DrawnTextFrame.tsx';

export interface DrawnFiguresProps {
  readonly text: string;
  readonly role: PlainRoleName;
  readonly color?: ColorToken;
}

export function DrawnFigures({
  text,
  role,
  color = 'text',
}: DrawnFiguresProps) {
  const theme = useTheme();
  return (
    <DrawnTextFrame
      role={role}
      widest={sameWidthFigures(text)}
      fill={theme.color[color]}
    >
      {text}
    </DrawnTextFrame>
  );
}
