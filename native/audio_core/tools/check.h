#ifndef KITBAG_TOOLS_CHECK_H
#define KITBAG_TOOLS_CHECK_H

// The assertion primitive every verify suite shares. Counted so a deleted
// RunXTests()/TestX() call cannot pass silently.
#include <cstdio>

namespace kitbag_test {

inline int g_failures = 0;
inline int g_checks = 0;

inline void Check(bool condition, const char* message) {
  ++g_checks;
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

}  // namespace kitbag_test

#endif  // KITBAG_TOOLS_CHECK_H
