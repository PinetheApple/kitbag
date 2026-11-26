#ifndef KITBAG_TOOLS_ABI_TEST_ENGINE_CLOCK_H
#define KITBAG_TOOLS_ABI_TEST_ENGINE_CLOCK_H

namespace abi_test {

void RunEngineClockAbiTests();
void RunBoottimeMappingAbiTests();
void RunExternalLockAbiTests();
void RunReanchorNudgeAbiTests();
void RunGridAnchorAbiTests();
void RunGridDownbeatAbiTests();

}  // namespace abi_test

#endif  // KITBAG_TOOLS_ABI_TEST_ENGINE_CLOCK_H
