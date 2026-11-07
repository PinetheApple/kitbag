#ifndef KITBAG_TOOLS_INDEX_LIST_H
#define KITBAG_TOOLS_INDEX_LIST_H

#include <string>
#include <vector>

namespace kitbag_test {

inline std::string IndexList(const std::vector<int>& indices) {
  std::string text = "{";
  for (size_t i = 0; i < indices.size(); ++i) {
    if (i > 0) text += ",";
    text += std::to_string(indices[i]);
  }
  return text + "}";
}

}  // namespace kitbag_test

#endif  // KITBAG_TOOLS_INDEX_LIST_H
