#include "kitbag_api.h"

#include <cmath>
#include <cstdio>
#include <filesystem>
#include <limits>
#include <string>
#include <vector>

#include "click_sound_test_support.h"
#include "media/file_audio_reader.h"
#include "metronome/click_sound_prepare.h"
#include "metronome/custom_sound_limits.h"

namespace click_sound_test {

using kitbag_test::Check;

namespace {

constexpr uint32_t kRate = kitbag::kCustomSoundRate;
constexpr size_t kMaxFrames =
    static_cast<size_t>(kitbag::kMaxCustomSoundSeconds) * kRate;
constexpr size_t kLongLead = 30011;
constexpr size_t kLongInputSeconds = 30;
// The kept 2 s, one chunk and the decoder's staging, with room to spare; a
// whole-file decode of the 30 s input needs over 5 MB.
constexpr size_t kPrepareHeapBudget = 640 * 1024;

bool Absent(const std::string& path) {
  return !std::filesystem::exists(path) &&
         !std::filesystem::exists(path + ".part");
}

uint64_t FramesIn(const std::string& path, uint32_t* rate, uint32_t* channels) {
  kitbag::FileAudioReader reader;
  if (!reader.Open(path.c_str())) return 0;
  *rate = reader.sample_rate();
  *channels = reader.channels();
  return reader.total_frames();
}

kb_result PrepareFrom(
    const std::string& name,
    const std::vector<float>& pcm,
    uint32_t rate,
    std::string* out
) {
  const std::string in = Fixture(name, pcm, 1, rate);
  *out = OutPath(name + "_out");
  const kb_result result = kitbag::PrepareClickSound(in.c_str(), out->c_str());
  std::remove(in.c_str());
  return result;
}

void TestLengthLimitCountsFromOnset() {
  std::string out;
  const std::vector<float> lead = SubThresholdLead(kLongLead);
  Check(
      PrepareFrom("cs_2s", Concat(lead, Body(kMaxFrames, 0.6F)), kRate, &out) ==
          KB_OK,
      "too long: exactly 2 s after a long lead-in is accepted"
  );
  std::remove(out.c_str());
  Check(
      PrepareFrom(
          "cs_2s1",
          Concat(lead, Body(kMaxFrames + 1, 0.6F)),
          kRate,
          &out
      ) == KB_ERROR_TOO_LONG,
      "too long: one frame past 2 s after the onset is refused"
  );
  Check(Absent(out), "too long: a refused file writes nothing");
}

void TestTrailingSilenceIsTrimmed() {
  constexpr size_t kTailSeconds = 3;
  std::string out;
  const std::vector<float> hit =
      Concat(SubThresholdLead(kLongLead), Body(kRate, 0.6F));
  const std::vector<float> tail = SubThresholdLead(kTailSeconds * kRate);
  Check(
      PrepareFrom("cs_tail", Concat(hit, tail), kRate, &out) == KB_OK,
      "tail: a 1 s hit with 3 s of quiet tail is accepted"
  );
  uint32_t rate = 0;
  uint32_t channels = 0;
  Check(
      FramesIn(out, &rate, &channels) == kRate,
      "tail: it is stored as the hit alone, through its last audible sample"
  );
  std::remove(out.c_str());
}

void TestSoundPastLimitIsRefused() {
  std::string out;
  const std::vector<float> body =
      Concat(Body(kMaxFrames + 1, 0.6F), SubThresholdLead(kRate));
  Check(
      PrepareFrom("cs_tail_long", body, kRate, &out) == KB_ERROR_TOO_LONG,
      "tail: sound past 2 s is refused even with a quiet tail"
  );
  const std::vector<float> late = Concat(
      Concat(Body(kRate / 2, 0.6F), SubThresholdLead(kMaxFrames)),
      Body(kRate / 4, 0.6F)
  );
  Check(
      PrepareFrom("cs_tail_late", late, kRate, &out) == KB_ERROR_TOO_LONG,
      "tail: a second sound starting past 2 s is refused"
  );
  Check(Absent(out), "tail: a refused file writes nothing");
}

void TestLongInputStaysBounded() {
  const std::string in =
      Fixture("cs_30s", Body(kLongInputSeconds * kRate, 0.6F), 1, kRate);
  const std::string out = OutPath("cs_30s_out");
  ResetHeapPeak();
  const kb_result result = kitbag::PrepareClickSound(in.c_str(), out.c_str());
  const size_t growth = HeapPeakGrowth();
  std::printf("  bounded: heap peak +%zu bytes over a 30 s input\n", growth);
  Check(
      result == KB_ERROR_TOO_LONG,
      "bounded: a 30 s input is refused as too long"
  );
  Check(
      growth < kPrepareHeapBudget,
      "bounded: prepare never holds more than about 2 s of audio"
  );
  std::remove(in.c_str());
}

void TestSilentIsRefused() {
  std::string out;
  Check(
      PrepareFrom("cs_zero", std::vector<float>(kRate, 0.0F), kRate, &out) ==
          KB_ERROR_SILENT,
      "silent: digital silence is refused"
  );
  Check(
      PrepareFrom("cs_hiss", SubThresholdLead(kRate), kRate, &out) ==
          KB_ERROR_SILENT,
      "silent: audio that never reaches -60 dBFS is refused"
  );
  Check(
      PrepareFrom("cs_empty", {}, kRate, &out) == KB_ERROR_SILENT,
      "silent: a file with no frames is refused"
  );
  Check(Absent(out), "silent: a refused file writes nothing");
}

kb_result PrepareRaw(const std::string& in, const char* out) {
  return kitbag::PrepareClickSound(in.c_str(), out);
}

void TestUndecodableIsRefused() {
  const std::string garbage = OutPath("cs_garbage");
  media_test::WriteBytes(garbage, std::vector<uint8_t>(4099, 0x5A));
  const std::string out = OutPath("cs_garbage_out");
  Check(
      PrepareRaw(garbage, out.c_str()) == KB_ERROR_INVALID_ARGUMENT,
      "undecodable: bytes that are no audio format are refused"
  );
  Check(
      PrepareRaw(garbage + ".missing", out.c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "undecodable: a missing file is refused"
  );
  Check(
      kitbag::PrepareClickSound(nullptr, out.c_str()) ==
          KB_ERROR_INVALID_ARGUMENT,
      "undecodable: a null input path is refused"
  );
  Check(
      PrepareRaw(garbage, nullptr) == KB_ERROR_INVALID_ARGUMENT,
      "undecodable: a null output path is refused"
  );
  Check(Absent(out), "undecodable: a refused file writes nothing");
  std::remove(garbage.c_str());
}

void TestNonFiniteIsRefused() {
  std::string out;
  std::vector<float> pcm = Body(kRate / 4, 0.5F);
  pcm[pcm.size() / 2] = std::numeric_limits<float>::quiet_NaN();
  Check(
      PrepareFrom("cs_nan", pcm, kRate, &out) == KB_ERROR_INVALID_ARGUMENT,
      "undecodable: a non-finite sample is refused"
  );
}

void TestRefusalKeepsExistingOutput() {
  const std::string out = OutPath("cs_keep_out");
  const std::vector<uint8_t> previous = {'k', 'e', 'e', 'p'};
  media_test::WriteBytes(out, previous);
  const std::string in =
      Fixture("cs_keep", std::vector<float>(kRate, 0.0F), 1, kRate);
  Check(
      kitbag::PrepareClickSound(in.c_str(), out.c_str()) == KB_ERROR_SILENT,
      "replace: a silent replacement is refused"
  );
  Check(
      std::filesystem::file_size(out) == previous.size(),
      "replace: a refused replacement leaves the slot's file as it was"
  );
  std::remove(in.c_str());
  std::remove(out.c_str());
}

void TestLoadMatchesPrepared() {
  constexpr uint32_t kCdRate = 44100;
  const std::string in = Fixture("cs_load", Body(kRate, 0.45F), 1, kRate);
  const std::string out = OutPath("cs_load_out");
  kitbag::PrepareClickSound(in.c_str(), out.c_str());
  std::vector<float> same;
  Check(
      kitbag::LoadClickSound(out.c_str(), kRate, &same) == KB_OK &&
          same.size() == kRate,
      "load: a prepared file loads whole at 48 kHz"
  );
  std::vector<float> cd;
  Check(
      kitbag::LoadClickSound(out.c_str(), kCdRate, &cd) == KB_OK &&
          std::labs(static_cast<long>(cd.size()) - long{kCdRate}) <= 1,
      "load: it is resampled to the engine rate"
  );
  std::remove(in.c_str());
  std::remove(out.c_str());
}

void TestLoadRefusesLongFile() {
  std::vector<float> none;
  const std::string longer =
      Fixture("cs_load_long", Body(kMaxFrames + kRate / 2, 0.5F), 1, kRate);
  Check(
      kitbag::LoadClickSound(longer.c_str(), kRate, &none) ==
              KB_ERROR_TOO_LONG &&
          none.empty(),
      "load: a file past 2 s is refused"
  );
  Check(
      kitbag::LoadClickSound(nullptr, kRate, &none) ==
          KB_ERROR_INVALID_ARGUMENT,
      "load: a null path is refused"
  );
  std::remove(longer.c_str());
}

}  // namespace

void RunRefusalTests() {
  TestLengthLimitCountsFromOnset();
  TestTrailingSilenceIsTrimmed();
  TestSoundPastLimitIsRefused();
  TestLongInputStaysBounded();
  TestSilentIsRefused();
  TestUndecodableIsRefused();
  TestNonFiniteIsRefused();
  TestRefusalKeepsExistingOutput();
}

void RunLoadTests() {
  TestLoadMatchesPrepared();
  TestLoadRefusesLongFile();
}

}  // namespace click_sound_test
