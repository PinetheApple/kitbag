#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "metronome/metronome_internal.h"
#include "mixer/transport_plan.h"
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
constexpr double kFireSlackFrames =
    kitbag::metronome_detail::kGridEpsilon * kSampleRate;

struct Model {
  double rate = kitbag::kUnityRate;
  double expected_song_frame = 0.0;
  double previous = 0.0;
  bool landed = true;
  bool playing = false;
  bool looping = false;
  int64_t frames = 0;
  std::vector<int64_t> clicks;
  int64_t wrong_positions = 0;
  std::vector<double> beats = Beats();
};

bool BeatSounds(const Model& model, double beat) {
  if (model.looping && beat > static_cast<double>(kLoopEnd - 1)) return false;
  const double slack = kFireSlackFrames;
  if (beat > model.expected_song_frame + slack) return false;
  return model.landed ? beat >= std::floor(model.expected_song_frame) - slack
                      : beat > model.previous + slack;
}

void Step(Model* model) {
  for (double beat : model->beats) {
    if (BeatSounds(*model, beat)) model->clicks.push_back(model->frames);
  }
  model->previous = model->expected_song_frame;
  model->landed = false;
  model->expected_song_frame += model->rate;
  if (model->looping &&
      model->expected_song_frame >= static_cast<double>(kLoopEnd)) {
    model->expected_song_frame =
        static_cast<double>(kLoopStart) +
        (model->expected_song_frame - static_cast<double>(kLoopEnd));
    model->landed = true;
  }
}

void Render(kb_engine* engine, Model* model, Take* take, int blocks) {
  for (int b = 0; b < blocks; ++b) {
    RenderPaced(engine, take, 1);
    for (uint32_t f = 0; f < kBlock; ++f, ++model->frames) {
      if (model->playing) Step(model);
    }
    if (model->playing &&
        kb_mixer_position(engine) !=
            static_cast<int64_t>(std::floor(model->expected_song_frame))) {
      ++model->wrong_positions;
    }
  }
}

void Seek(kb_engine* engine, Model* model, int64_t frame) {
  kb_mixer_seek(engine, frame);
  model->expected_song_frame = static_cast<double>(frame);
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
      click_take::SameClicks(
          click_take::DetectClicks(take.right),
          model.clicks
      ),
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
