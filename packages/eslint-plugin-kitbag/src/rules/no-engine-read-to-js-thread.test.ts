import { RuleTester } from '@typescript-eslint/rule-tester';

import { noEngineReadToJsThread } from './no-engine-read-to-js-thread.ts';

const ruleTester = new RuleTester();

const TOOL = '/repo/packages/tool-drill/src/useDrillFrame.ts';
const error = [{ messageId: 'engineReadToJs' as const }];

ruleTester.run('no-engine-read-to-js-thread', noEngineReadToJsThread, {
  valid: [
    {
      code: `
        const { barPhase } = host.engine.reads;
        useFrameCallback(() => {
          'worklet';
          phase.value = barPhase();
        });`,
      filename: TOOL,
    },
    {
      code: `
        const [open, setOpen] = useState(false);
        const tap = Gesture.Tap().onEnd(() => {
          runOnJS(setOpen)(true);
        });`,
      filename: TOOL,
    },
    {
      code: `
        const reads = host.engine.reads;
        useFrameCallback(() => {
          if (reads.currentBeat() === 0) scheduleOnRN(countBar);
        });`,
      filename: TOOL,
    },
    {
      code: `
        const [tempo, setTempo] = useState(0);
        function onPress() {
          setTempo(host.engine.reads.currentBpm());
        }`,
      filename: TOOL,
    },
    {
      code: `
        const { barPhase } = host.engine.reads;
        const phase = 1;
        useFrameCallback(() => {
          'worklet';
          shown.value = barPhase();
          scheduleOnRN(report, { phase: 0 });
        });`,
      filename: TOOL,
    },
  ],
  invalid: [
    {
      code: `
        const { barPhase } = host.engine.reads;
        const store = host.store.createToolStore({ phase: 0 });
        useFrameCallback(() => {
          'worklet';
          scheduleOnRN(store.setState, { phase: barPhase() });
        });`,
      filename: TOOL,
      errors: error,
    },
    {
      code: `
        const [level, setLevel] = useState(0);
        useFrameCallback(() => {
          runOnJS(setLevel)(host.engine.reads.barPhase());
        });`,
      filename: TOOL,
      errors: error,
    },
    {
      code: `
        const { barPhase } = host.engine.reads;
        useFrameCallback(() => {
          const phase = barPhase();
          const doubled = phase * 2;
          scheduleOnRN(report, doubled);
        });`,
      filename: TOOL,
      errors: error,
    },
    {
      code: `
        const reads = host.engine.reads;
        const push = useCallback((bpm) => setTempo(bpm), []);
        const onFrame = useCallback(() => {
          'worklet';
          runOnJS(push)(reads.currentBpm());
        }, [push]);`,
      filename: TOOL,
      errors: error,
    },
    {
      code: `
        const { barPhase } = host.engine.reads;
        const [phase, setPhase] = useState(0);
        useAnimatedReaction(
          () => barPhase(),
          (next) => {
            runOnJS(setPhase)(next);
          },
        );`,
      filename: TOOL,
      errors: error,
    },
    {
      code: `
        const currentBeat = host.engine.reads.currentBeat;
        function onFrame() {
          'worklet';
          let beat = 0;
          beat = currentBeat();
          store.setState({ beat });
        }`,
      filename: TOOL,
      errors: error,
    },
    {
      code: `
        const { currentBpm } = host.engine.reads;
        const [bpm, setBpm] = useState(0);
        useDerivedValue(() => {
          setBpm(currentBpm());
        });`,
      filename: TOOL,
      errors: error,
    },
  ],
});
