// The bulk ring on its own: wrap arithmetic and the full/empty boundaries that
// AudioSource's tests would only reach by accident.
#include "rt/spsc_bulk_ring.h"

#include <vector>

#include "rt_test_support.h"

namespace rt_test {
namespace {

using kitbag::SpscBulkRing;

std::vector<float> Ramp(int first, int count) {
  std::vector<float> values(count);
  for (int i = 0; i < count; ++i) values[i] = static_cast<float>(first + i);
  return values;
}

bool Matches(const std::vector<float>& values, int first, size_t count) {
  for (size_t i = 0; i < count; ++i) {
    if (values[i] != static_cast<float>(first + i)) return false;
  }
  return true;
}

void TestCapacityRounding() {
  SpscBulkRing<float> ring;
  ring.Init(300);
  kitbag_test::Check(ring.capacity() == 512, "ring: capacity rounds up to 2^n");
  kitbag_test::Check(ring.read_available() == 0, "ring: starts empty");
  kitbag_test::Check(ring.write_available() == 512, "ring: starts writable");
}

// 5 in, 3 out, then 6 in leaves the tail mid-buffer and the head past the
// wrap, so the next read has to splice two spans in the right order.
void TestWrapSplice() {
  SpscBulkRing<float> ring;
  ring.Init(8);
  const std::vector<float> first = Ramp(0, 5);
  kitbag_test::Check(ring.Write(first.data(), 5) == 5, "ring: accepts 5");

  std::vector<float> out(16, -1.0F);
  kitbag_test::Check(ring.Read(out.data(), 3) == 3, "ring: reads 3");
  kitbag_test::Check(Matches(out, 0, 3), "ring: reads them in order");

  const std::vector<float> second = Ramp(5, 6);
  kitbag_test::Check(ring.Write(second.data(), 6) == 6, "ring: accepts 6 more");
  kitbag_test::Check(ring.read_available() == 8, "ring: holds 8");
  kitbag_test::Check(ring.Read(out.data(), 8) == 8, "ring: reads all 8");
  kitbag_test::Check(Matches(out, 3, 8), "ring: splices the wrap in order");
  kitbag_test::Check(ring.read_available() == 0, "ring: empties");
}

void TestFullAndStarved() {
  SpscBulkRing<float> ring;
  ring.Init(4);
  const std::vector<float> values = Ramp(0, 10);
  kitbag_test::Check(ring.Write(values.data(), 10) == 4, "ring: write clamps");
  kitbag_test::Check(ring.write_available() == 0, "ring: reports full");
  kitbag_test::Check(ring.Write(values.data(), 1) == 0, "ring: full accepts 0");

  std::vector<float> out(10, -1.0F);
  kitbag_test::Check(ring.Read(out.data(), 10) == 4, "ring: read clamps");
  kitbag_test::Check(Matches(out, 0, 4), "ring: clamped write kept the head");
  kitbag_test::Check(ring.Read(out.data(), 1) == 0, "ring: empty delivers 0");
}

// Clear is the one operation neither side owns; it exists for Seek, so what
// matters is that the next read starts from the new data, not the old.
void TestClear() {
  SpscBulkRing<float> ring;
  ring.Init(8);
  const std::vector<float> stale = Ramp(0, 6);
  ring.Write(stale.data(), 6);
  ring.Clear();
  kitbag_test::Check(ring.read_available() == 0, "ring: clear empties");
  kitbag_test::Check(ring.write_available() == 8, "ring: clear frees space");

  const std::vector<float> fresh = Ramp(100, 3);
  ring.Write(fresh.data(), 3);
  std::vector<float> out(8, -1.0F);
  kitbag_test::Check(ring.Read(out.data(), 8) == 3, "ring: clear left only 3");
  kitbag_test::Check(Matches(out, 100, 3), "ring: reads after clear are fresh");
}

}  // namespace

void RunBulkRingTests() {
  TestCapacityRounding();
  TestWrapSplice();
  TestFullAndStarved();
  TestClear();
}

}  // namespace rt_test
