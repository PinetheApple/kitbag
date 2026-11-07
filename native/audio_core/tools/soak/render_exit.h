#ifndef KITBAG_TOOLS_SOAK_RENDER_EXIT_H
#define KITBAG_TOOLS_SOAK_RENDER_EXIT_H

namespace click_soak {

// kUsage is click_soak's own; kFailed sits outside its 0-5, so soak-analyze.sh's
// one exit range stays unambiguous.
enum class RenderExit : int { kWritten = 0, kUsage = 2, kFailed = 8 };

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_RENDER_EXIT_H
