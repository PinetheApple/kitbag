import { RuleTester } from '@typescript-eslint/rule-tester';

import { noStateWritesInFrameCallback } from './no-state-writes-in-frame-callback';

const ruleTester = new RuleTester();

const TOOL = '/repo/packages/tool-drill/src/useDrillFrame.ts';

ruleTester.run(
  'no-state-writes-in-frame-callback',
  noStateWritesInFrameCallback,
  {
    valid: [
      {
        code: `
          useFrameCallback(() => {
            'worklet';
            phase.value = barPhase();
          });`,
        filename: TOOL,
      },
      {
        code: `
          const [open, setOpen] = useState(false);
          const store = host.store.createToolStore({ reps: 0 });
          function onPress() {
            setOpen(true);
            store.setState({ reps: 1 });
          }`,
        filename: TOOL,
      },
      {
        code: `
          const reportLock = useCallback((index) => onLocked(index), []);
          useFrameCallback(() => {
            'worklet';
            scheduleOnRN(reportLock, currentBeat());
          });`,
        filename: TOOL,
      },
    ],
    invalid: [
      {
        code: `
          const store = host.store.createToolStore({ phase: 0 });
          useFrameCallback(() => {
            'worklet';
            scheduleOnRN(store.setState, { phase: barPhase() });
          });`,
        filename: TOOL,
        errors: [{ messageId: 'stateWrite' }],
      },
      {
        code: `
          const [level, setLevel] = useState(0);
          useFrameCallback(() => {
            runOnJS(setLevel)(barPhase());
          });`,
        filename: TOOL,
        errors: [{ messageId: 'stateWrite' }],
      },
      {
        code: `
          function onFrame() {
            'worklet';
            store.setState({ beat: currentBeat() });
          }`,
        filename: TOOL,
        errors: [{ messageId: 'stateWrite' }],
      },
      {
        code: `
          const onFrame = () => {
            'worklet';
            scheduleOnRN(setTempo, currentBpm());
          };
          const [tempo, setTempo] = React.useState(0);`,
        filename: TOOL,
        errors: [{ messageId: 'stateWrite' }],
      },
    ],
  },
);
