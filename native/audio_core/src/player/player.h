#ifndef KITBAG_PLAYER_PLAYER_H
#define KITBAG_PLAYER_PLAYER_H

#include <atomic>
#include <cstdint>
#include <vector>

#include "media/streaming_track.h"
#include "rt/spsc_ring.h"

namespace kitbag {

/// Single-source transport for full-file playback on the engine clock
/// (SPEC.md §4.1). The player is the mixer's one-track sibling: its streaming
/// transport is a StreamingTrack; play/pause/seek cross the command ring and are
/// applied by the callback. Render accumulates into an output the mixer already
/// cleared, so the two compose additively in Engine::Render.
class Player {
 public:
  /// [engine_rate] is the device rate the source is resampled to on load, so
  /// Render never sees a rate mismatch. scratch_ is sized once here for the
  /// widest supported block and never reallocated.
  explicit Player(uint32_t engine_rate)
      : stream_(engine_rate),
        scratch_(
            static_cast<size_t>(StreamingTrack::kMaxBlockFrames) *
                StreamingTrack::kMaxChannels,
            0.0f
        ) {}
  ~Player() = default;
  Player(const Player&) = delete;
  Player& operator=(const Player&) = delete;

  /// Load a file, streamed from disk. [now_frame] is the engine clock and
  /// [engine_running] true whenever the callback can run; together they date the
  /// retired source for deferred reclamation. Returns false for a null path or a
  /// file that will not open.
  bool Load(const char* path, uint64_t now_frame, bool engine_running) {
    return stream_.Load(path, now_frame, engine_running);
  }

  /// Retire the loaded source; the player goes back to having nothing to play.
  void Unload(uint64_t now_frame, bool engine_running) {
    stream_.Unload(now_frame, engine_running);
  }

  /// Non-blocking: true once a source is live (published).
  bool ready() const {
    return stream_.ready();
  }

  /// Transport. The off-thread read-ahead work runs here on the app thread; the
  /// transport counter and playing flag cross the command ring so the callback
  /// remains their sole writer and a seek can never overwrite a block advance.
  void Play();
  /// Ends playback holding position, so a following Play resumes there. The
  /// player has no stop-to-zero: SPEC.md §4.1 lists only pause for a single-file
  /// player, and rewind is kb_player_seek(0). One export per behaviour (§16).
  void Pause();
  /// Seek to [frame] at the engine rate; the counter update is applied by the
  /// callback next block. Routes through StreamingTrack, which rebuilds and swaps
  /// a fresh source when the device is live rather than racing a ring Clear (#25).
  /// [now_frame]/[engine_running] date the retired source as Load does.
  void Seek(uint64_t frame, uint64_t now_frame, bool engine_running);

  /// Callback-published mirrors. Converge within one block once the device runs.
  bool is_playing() const {
    return playing_.load(std::memory_order_relaxed);
  }
  uint64_t position() const {
    return read_frame_.load(std::memory_order_relaxed);
  }
  uint64_t frames() const {
    return stream_.frames();
  }
  /// Realtime-safe: frames buffered ahead in the published source.
  uint64_t rt_buffered() const {
    return stream_.rt_buffered();
  }

  /// Renders the published source into [output] — interleaved stereo float,
  /// [frame_count] frames at engine rate. RT-safe: drains the ring, one acquire
  /// load, reads into pre-sized scratch. Allocates nothing, takes no lock, frees
  /// nothing. Accumulates rather than assigns, so it composes on top of the mixer.
  void Render(float* output, uint32_t frame_count);

  /// Commands dropped because the ring was full since construction; a diagnostic.
  uint64_t dropped_commands() const {
    return dropped_commands_;
  }

  /// App thread, callback quiescent. Frees a source retired but not yet
  /// reclaimed; Engine::Stop calls it, mirroring the mixer.
  void ReleaseRetiredSources() {
    stream_.ReleaseRetiredSources();
  }

 private:
  enum class CommandType : uint8_t {
    kPlay,
    kPause,
    kSeek,
  };

  struct Command {
    CommandType type;
    uint64_t frame = 0;  // engine-clock target for kSeek
  };

  static constexpr size_t kCommandRingSize = 64;

  void Enqueue(const Command& command);

  // Command drain, run at the top of Render. ApplyCommand holds the only
  // exhaustive switch over CommandType, so a new command is a -Wswitch error
  // rather than a silent drop.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);
  void AdvanceTransport(uint64_t start_frame, uint32_t frame_count);

  StreamingTrack stream_;
  // Drain target, sized once at construction and never reallocated.
  std::vector<float> scratch_;
  // Written only by the callback (command drain + block advance); the getters
  // read it. Single writer, so a seek can never overwrite a block advance.
  std::atomic<uint64_t> read_frame_{0};
  std::atomic<bool> playing_{false};
  SpscRing<Command, kCommandRingSize> commands_;
  // App thread only. Counts commands dropped because the ring was full.
  uint64_t dropped_commands_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_PLAYER_PLAYER_H
