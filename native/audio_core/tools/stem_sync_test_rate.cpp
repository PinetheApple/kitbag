#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "check.h"
#include "metronome/metronome_internal.h"
#include "stem_sync_rate.h"

namespace stem_sync {
namespace {

using kitbag_test::Check;

// Off every beat, so no seek lands a click on its own first frame.
constexpr int64_t kSeekAhead = 300007;
constexpr int64_t kSeekBack = 30011;
constexpr int64_t kLoopStart = 61089;
constexpr int64_t kLoopEnd = 150023;
constexpr int kPlayBlocks = 400;
constexpr int kPauseBlocks = 30;
constexpr int kLoopBlocks = 1500;
constexpr int kClearBlocks = 300;
constexpr double kRates[] = {0.5, 0.75};
constexpr int kMaxShownClicks = 4;
constexpr double kFireSlackFrames =
    kitbag::metronome_detail::kGridEpsilon * kRate;

// The fractional song frame the output should sound, stepped once per frame.
struct Model {
  double rate = kUnity;
  double song = 0.0;
  double previous = 0.0;
  bool landed = true;
  bool playing = false;
  bool looping = false;
  int64_t frames = 0;
  std::vector<int64_t> clicks;
  int64_t wrong_positions = 0;
};

bool BeatSounds(const Model& model, double beat) {
  if (model.looping && beat > static_cast<double>(kLoopEnd - 1)) return false;
  const double slack = kFireSlackFrames;
  if (beat > model.song + slack) return false;
  return model.landed ? beat >= std::floor(model.song) - slack
                      : beat > model.previous + slack;
}

void Step(Model* model) {
  for (double beat : Beats()) {
    if (BeatSounds(*model, beat)) model->clicks.push_back(model->frames);
  }
  model->previous = model->song;
  model->landed = false;
  model->song += model->rate;
  if (model->looping && model->song >= static_cast<double>(kLoopEnd)) {
    model->song = static_cast<double>(kLoopStart) +
                  (model->song - static_cast<double>(kLoopEnd));
    model->landed = true;
  }
}

void Render(kb_engine* engine, Model* model, Take* take, int blocks) {
  for (int b = 0; b < blocks; ++b) {
    RenderPaced(engine, take, 1);
    for (uint32_t f = 0; f < kBlock; ++f, ++model->frames) {
      if (model->playing) Step(model);
    }
    if (model->playing && kb_mixer_position(engine) !=
                              static_cast<int64_t>(std::floor(model->song))) {
      ++model->wrong_positions;
    }
  }
}

void Seek(kb_engine* engine, Model* model, int64_t frame) {
  kb_mixer_seek(engine, frame);
  model->song = static_cast<double>(frame);
  model->landed = true;
}

void SetPlaying(kb_engine* engine, Model* model, bool playing) {
  if (playing) {
    kb_mixer_play(engine);
  } else {
    kb_mixer_pause(engine);
  }
  model->playing = playing;
}

void RunScript(kb_engine* engine, Model* model, Take* take) {
  SetPlaying(engine, model, true);
  Render(engine, model, take, kPlayBlocks);
  Seek(engine, model, kSeekAhead);
  Render(engine, model, take, kPlayBlocks);
  SetPlaying(engine, model, false);
  Render(engine, model, take, kPauseBlocks);
  SetPlaying(engine, model, true);
  Render(engine, model, take, kPlayBlocks);
  Seek(engine, model, kSeekBack);
  kb_mixer_set_loop(engine, kLoopStart, kLoopEnd);
  model->looping = true;
  Render(engine, model, take, kLoopBlocks);
  kb_mixer_clear_loop(engine);
  model->looping = false;
  Render(engine, model, take, kClearBlocks);
}

bool SameClicks(
    const std::vector<int64_t>& got,
    const std::vector<int64_t>& want
) {
  bool same = got.size() == want.size();
  int shown = 0;
  for (size_t i = 0; i < got.size() && i < want.size(); ++i) {
    if (got[i] == want[i]) continue;
    same = false;
    if (++shown > kMaxShownClicks) continue;
    std::fprintf(
        stderr,
        "  click %zu at %lld, expected %lld\n",
        i,
        (long long)got[i],
        (long long)want[i]
    );
  }
  if (got.size() != want.size()) {
    std::fprintf(stderr, "  %zu clicks, want %zu\n", got.size(), want.size());
  }
  return same;
}

void TestScriptAtRate(const std::string& stem, double rate) {
  kb_engine* engine = OpenFollowingEngine(stem);
  if (engine == nullptr) return;
  kb_mixer_set_rate(engine, static_cast<float>(rate));
  Model model;
  model.rate = rate;
  Take take;
  RunScript(engine, &model, &take);
  kb_engine_destroy(engine);
  const std::string name = "rate " + std::to_string(rate);
  Check(
      SameClicks(DetectClicks(take.right), model.clicks),
      (name + ": seek, pause and loop keep every click on its frame").c_str()
  );
  Check(
      model.wrong_positions == 0,
      (name + ": the position reads song frames, seek and loop included")
          .c_str()
  );
  if (model.wrong_positions != 0) {
    std::fprintf(
        stderr,
        "  %lld blocks off\n",
        (long long)model.wrong_positions
    );
  }
}

}  // namespace

void RunScriptTests(const std::string& stem) {
  for (double rate : kRates) TestScriptAtRate(stem, rate);
}

}  // namespace stem_sync
