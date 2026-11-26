import type { ColorToken } from '../tokens.ts';
import { useTheme } from '../ThemeProvider.tsx';
import type { PlainRoleName } from './drawnText.ts';
import { DrawnTextFrame } from './DrawnTextFrame.tsx';

export interface DrawnFiguresProps {
  readonly text: string;
  readonly role: PlainRoleName;
  readonly color?: ColorToken;
}

const ANY_DIGIT = /\d/g;
const SAME_WIDTH_DIGIT = '0';

export function DrawnFigures({
  text,
  role,
  color = 'text',
}: DrawnFiguresProps) {
  const theme = useTheme();
  return (
    <DrawnTextFrame
      role={role}
      widest={text.replace(ANY_DIGIT, SAME_WIDTH_DIGIT)}
      fill={theme.color[color]}
    >
      {text}
    </DrawnTextFrame>
  );
}
