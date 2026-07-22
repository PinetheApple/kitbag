#ifndef KITBAG_PLAYER_PLAYER_H
#define KITBAG_PLAYER_PLAYER_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <vector>

#include "media/audio_source.h"
#include "rt/rt_publisher.h"
#include "rt/spsc_ring.h"

namespace kitbag {

/// Single-source transport for full-file playback on the engine clock
/// (SPEC.md §4.1). The player is the mixer's one-track sibling and reuses its
/// two app→RT disciplines and no third: the loaded source is built off-thread
/// and swapped in by RtPublisher; play/pause/seek cross the command ring and are
/// applied by the callback. Render accumulates into the output the mixer already
/// cleared, so the two compose additively in Engine::Render.
class Player {
 public:
  /// Largest block Render services; scratch is sized to it at construction so
  /// Render never allocates. Mono or stereo only, matching the mixer.
  static constexpr uint32_t kMaxBlockFrames = 4096;
  static constexpr uint32_t kMaxChannels = 2;

  /// [engine_rate] is the device rate the source is resampled to on load, so
  /// Render never sees a rate mismatch. scratch_ is sized once here for the
  /// widest supported block and never reallocated.
  explicit Player(uint32_t engine_rate)
      : engine_rate_(engine_rate),
        scratch_(static_cast<size_t>(kMaxBlockFrames) * kMaxChannels, 0.0f) {}
  /// Live source deleted by the publisher dtor; teardown order enforced by
  /// PlayerSource field order (below).
  ~Player() = default;
  Player(const Player&) = delete;
  Player& operator=(const Player&) = delete;

  /// Load a file, streamed from disk. [now_frame] is the engine clock and
  /// [engine_running] true whenever the callback can run; together they date the
  /// retired source for deferred reclamation. Returns false for a null path or a
  /// file that will not open.
  bool Load(const char* path, uint64_t now_frame, bool engine_running);

  /// Retire the source: publishes an empty node so the callback drains nothing,
  /// and the old source is reclaimed off the callback, never freed on it.
  void Unload(uint64_t now_frame, bool engine_running);

  /// Non-blocking: true once a source is live (published).
  bool ready() const;

  /// Transport. The off-thread read-ahead work runs here on the app thread; the
  /// transport counter and playing flag cross the command ring so the callback is
  /// their sole writer and a seek can never overwrite a concurrent block advance.
  void Play();
  /// Ends playback holding the position, so a following Play resumes there. The
  /// player has no stop-to-zero: SPEC.md §4.1 lists only pause for the single-file
  /// player, and a rewind is kb_player_seek(0). One export per behaviour (§16).
  void Pause();
  /// Seek to a frame at the engine rate. The counter update is applied by the
  /// callback next block; the source reposition is done here.
  void Seek(uint64_t frame);

  /// Callback-published mirrors. Converge within one block once the device runs.
  bool is_playing() const {
    return playing_.load(std::memory_order_relaxed);
  }
  uint64_t position() const {
    return read_frame_.load(std::memory_order_relaxed);
  }
  uint64_t frames() const {
    return num_frames_.load(std::memory_order_relaxed);
  }

  /// Reads the published source and accumulates it into [output] — interleaved
  /// stereo, [frame_count] frames at the engine rate. RT-safe: drains the ring,
  /// one acquire load, reads into pre-sized scratch. Allocates nothing, takes no
  /// lock, frees nothing. Accumulates rather than assigns, so it composes on top
  /// of the mixer without erasing it.
  void Render(float* output, uint32_t frame_count);

  /// Commands dropped because the ring was full since construction; a diagnostic.
  uint64_t dropped_commands() const {
    return dropped_commands_;
  }

  /// App thread, callback quiescent. Frees the source retired but not yet
  /// reclaimed; Engine::Stop calls it, mirroring the mixer.
  void ReleaseRetiredSources();

 private:
  /// The published, playable source. `source` is declared LAST so its dtor —
  /// which joins the read-ahead thread — runs before the readers it points into
  /// are destroyed (the teardown-order rule the mixer's TrackSource records).
  struct PlayerSource {
    uint32_t channels = 0;
    uint64_t num_frames = 0;
    std::unique_ptr<SourceReader> owned_reader;
    std::unique_ptr<SourceReader> resampler;
    std::unique_ptr<AudioSource> source;
  };

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

  bool BuildSource(PlayerSource& ps, SourceReader* base);
  void Publish(
      std::unique_ptr<PlayerSource> ps,
      uint64_t now_frame,
      bool engine_running
  );
  void Prime(AudioSource& src, uint64_t num_frames);
  void Enqueue(const Command& command);

  // Command drain, run at the top of Render. ApplyCommand holds the only
  // exhaustive switch over CommandType, so a new command is a -Wswitch error
  // rather than a silent drop.
  void ApplyPendingCommands();
  void ApplyCommand(const Command& command);

  static void MixMono(const float* src, float* output, uint32_t frames);
  static void MixStereo(
      const float* src,
      uint32_t channels,
      float* output,
      uint32_t frames
  );
  void MixInto(const PlayerSource& src, float* output, uint32_t frame_count);
  void AdvanceTransport(uint64_t start_frame, uint32_t frame_count);

  RtPublisher<PlayerSource> published_;
  AudioSource* live_source_ = nullptr;  // app thread; == the published source
  uint64_t live_num_frames_ = 0;        // app thread
  // The output/device rate the source is resampled to on load.
  uint32_t engine_rate_;
  // Drain target, sized once at construction and never reallocated.
  std::vector<float> scratch_;
  // Written only by the callback (command drain + block advance); the getters
  // read it. Single writer, so a seek can never overwrite a block advance.
  std::atomic<uint64_t> read_frame_{0};
  // Written by the load path, read every block by AdvanceTransport. A load can
  // overlap the callback, so it is atomic (relaxed): a plain uint64_t could tear
  // on armv7 (#23). Relaxed is enough — the source itself crosses via the
  // publisher's release/acquire, no ordering rides on this length.
  std::atomic<uint64_t> num_frames_{0};
  std::atomic<bool> playing_{false};
  SpscRing<Command, kCommandRingSize> commands_;
  // App thread only. Counts commands dropped because the ring was full.
  uint64_t dropped_commands_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_PLAYER_PLAYER_H
