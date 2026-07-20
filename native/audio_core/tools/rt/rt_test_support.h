#ifndef KITBAG_TOOLS_RT_RT_TEST_SUPPORT_H
#define KITBAG_TOOLS_RT_RT_TEST_SUPPORT_H

// Entry point for the rt/ primitives suite. These are subsystem-independent, so
// they carry no rig beyond check.h — they link into whichever binary hosts them.
#include "check.h"

namespace rt_test {

void RunPublisherTests();

}  // namespace rt_test

#endif  // KITBAG_TOOLS_RT_RT_TEST_SUPPORT_H
