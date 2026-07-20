#ifndef KITBAG_ANALYSIS_SIDECAR_PATH_H
#define KITBAG_ANALYSIS_SIDECAR_PATH_H

#include <cstring>
#include <string>

namespace kitbag {

/// Builds the ".kwav" waveform-sidecar path for `song_path` inside `dir`.
///
/// The extension search is confined to the basename: a dot in a parent
/// directory name is not an extension, and a leading dot is a hidden-file
/// marker rather than one either — `.hidden` keeps its whole name.
inline std::string SidecarPath(const char* dir, const char* song_path) {
  std::string out = dir == nullptr ? std::string() : std::string(dir);
  if (!out.empty() && out.back() != '/') {
    out += '/';
  }

  const char* slash = std::strrchr(song_path, '/');
  const char* basename = slash == nullptr ? song_path : slash + 1;

  const char* dot = std::strrchr(basename, '.');
  const size_t stem_len = dot == nullptr || dot == basename
                              ? std::strlen(basename)
                              : static_cast<size_t>(dot - basename);

  out.append(basename, stem_len);
  out += ".kwav";
  return out;
}

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_SIDECAR_PATH_H
