import {
  createThemedStyles,
  size,
  textRoles,
  textStyle,
  useKeyboardDidHide,
  useTheme,
} from '@kitbag/core-design';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TextInput } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  input: {
    ...textStyle(textRoles.stemName),
    color: theme.color.text,
    flex: 1,
    padding: 0,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.accentDim,
  },
}));

interface StemNameEditorProps {
  readonly name: string;
  readonly onDone: (name: string) => void;
}

export function StemNameEditor({ name, onDone }: StemNameEditorProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [draft, setDraft] = useState(name);
  const latest = useRef({ draft: name, onDone, finished: false });
  useEffect(() => {
    latest.current.onDone = onDone;
  });
  const change = useCallback((text: string) => {
    latest.current.draft = text;
    setDraft(text);
  }, []);
  const finish = useCallback(() => {
    if (latest.current.finished) return;
    latest.current.finished = true;
    latest.current.onDone(latest.current.draft);
  }, []);
  useKeyboardDidHide(finish);
  // A layout cleanup runs before the screen's passive close(), so leaving the
  // player mid-edit still stores the name against the session it was typed in.
  useLayoutEffect(() => finish, [finish]);
  return (
    <TextInput
      style={styles.input}
      value={draft}
      onChangeText={change}
      onBlur={finish}
      placeholder={name}
      placeholderTextColor={theme.color.text3}
      accessibilityLabel={`New name for ${name}`}
      returnKeyType="done"
      autoFocus
      selectTextOnFocus
    />
  );
}
