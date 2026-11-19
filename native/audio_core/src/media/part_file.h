#ifndef KITBAG_MEDIA_PART_FILE_H
#define KITBAG_MEDIA_PART_FILE_H

#include <cstdint>
#include <cstdio>
#include <functional>
#include <string>

namespace kitbag {

inline constexpr const char* kPartSuffix = ".part";

enum class FileWrite : uint8_t { kOk, kNoSpace, kFailed };

// Renames path + kPartSuffix onto path; a failed rename removes the .part.
FileWrite CommitPartFile(const std::string& path);
// Writes path + kPartSuffix through `write`, then commits it.
FileWrite WritePartFile(
    const std::string& path,
    const std::function<bool(std::FILE*)>& write
);

}  // namespace kitbag

#endif  // KITBAG_MEDIA_PART_FILE_H
