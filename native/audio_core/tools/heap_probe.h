#ifndef KITBAG_TOOLS_HEAP_PROBE_H
#define KITBAG_TOOLS_HEAP_PROBE_H

#include <atomic>
#include <cstddef>

namespace kitbag_test {

inline std::atomic<size_t> g_live_bytes{0};
inline std::atomic<size_t> g_peak_bytes{0};
inline size_t g_heap_baseline = 0;

inline void ResetHeapPeak() {
  g_heap_baseline = g_live_bytes.load();
  g_peak_bytes.store(g_heap_baseline);
}

inline size_t HeapPeakGrowth() {
  return g_peak_bytes.load() - g_heap_baseline;
}

inline size_t LiveHeapBytes() {
  return g_live_bytes.load();
}

}  // namespace kitbag_test

#endif  // KITBAG_TOOLS_HEAP_PROBE_H
