#include <cstdio>
#include <string>
#include <vector>

#include "soak_cli.h"

int main(int argc, char** argv) {
  const std::vector<std::string> args(argv + 1, argv + argc);
  return click_soak::RunClickSoak(args, stdout, stderr);
}
