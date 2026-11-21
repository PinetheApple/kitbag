import { Button, ButtonRow } from '@kitbag/core-design';

export interface Choice {
  readonly key: string;
  readonly label: string;
  readonly primary: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

export function ChoiceButtons({
  choices,
}: {
  readonly choices: readonly Choice[];
}) {
  if (choices.length === 0) return null;
  return (
    <ButtonRow>
      {choices.map((choice) => (
        <Button
          key={choice.key}
          fill
          variant={choice.primary ? 'primary' : 'ghost'}
          label={choice.label}
          disabled={choice.disabled}
          onPress={choice.onPress}
        />
      ))}
    </ButtonRow>
  );
}
