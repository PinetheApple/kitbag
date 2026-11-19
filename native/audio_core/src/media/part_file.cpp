#include "media/part_file.h"

#include <cerrno>
#include <filesystem>
#include <system_error>

namespace kitbag {

namespace {

FileWrite FromErrno(int error) {
  return error == ENOSPC ? FileWrite::kNoSpace : FileWrite::kFailed;
}

}  // namespace

FileWrite CommitPartFile(const std::string& path) {
  const std::string part = path + kPartSuffix;
  std::error_code error;
  std::filesystem::rename(part, path, error);
  if (!error) return FileWrite::kOk;
  std::remove(part.c_str());
  return FromErrno(error.value());
}

FileWrite WritePartFile(
    const std::string& path,
    const std::function<bool(std::FILE*)>& write
) {
  const std::string part = path + kPartSuffix;
  std::FILE* file = std::fopen(part.c_str(), "wb");
  if (file == nullptr) return FromErrno(errno);
  const bool written = write(file);
  const int write_error = written ? 0 : errno;
  const bool closed = std::fclose(file) == 0;
  const int close_error = closed ? 0 : errno;
  if (written && closed) return CommitPartFile(path);
  std::remove(part.c_str());
  return FromErrno(written ? close_error : write_error);
}

}  // namespace kitbag
