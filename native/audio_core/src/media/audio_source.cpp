#include "media/audio_source.h"

#include <algorithm>
#include <chrono>

namespace kitbag {
namespace {

// The reader thread has no producer to wake it, so it polls for ring space and
// for a source that answered kWouldBlock. Well under the read-ahead the ring
// holds, so a poll never costs a frame.
constexpr auto kRefillPollInterval = std::chrono::milliseconds(2);

// One decode call per 512 frames amortises a decoder's per-call cost over
// roughly a device buffer's worth of audio. Private: no caller can choose it,
// only the ring size is a parameter.
constexpr uint32_t kRefillChunkFrames = 512;

// A refill only runs when a whole chunk fits, so a chunk wider than half the
// ring would never fit and the source would starve forever.
uint32_t ChunkFrames(uint32_t ring_frames) {
  const uint32_t half = ring_frames / 2;
  if (half == 0) return 1;
  return half < kRefillChunkFrames ? half : kRefillChunkFrames;
}

}  // namespace

AudioSource::~AudioSource() {
  Close();
}

bool AudioSource::Open(SourceReader* reader, uint32_t ring_frames) {
  if (running_.load(std::memory_order_relaxed) || reader == nullptr) {
    return false;
  }
  const uint32_t channels = reader->channels();
  if (channels == 0 || ring_frames == 0) return false;

  reader_ = reader;
  channels_.store(channels, std::memory_order_relaxed);
  sample_rate_ = reader->sample_rate();
  ring_.Init(static_cast<size_t>(ring_frames) * channels);
  chunk_frames_ = ChunkFrames(ring_frames);
  staging_.assign(static_cast<size_t>(chunk_frames_) * channels, 0.0F);
  input_exhausted_.store(false, std::memory_order_relaxed);
  end_of_stream_.store(false, std::memory_order_relaxed);
  underruns_.store(0, std::memory_order_relaxed);
  position_.store(0, std::memory_order_relaxed);
  return true;
}

bool AudioSource::Start() {
  if (running_.load(std::memory_order_relaxed) || reader_ == nullptr) {
    return false;
  }
  running_.store(true, std::memory_order_relaxed);
  thread_ = std::thread(&AudioSource::RefillLoop, this);
  return true;
}

void AudioSource::Stop() {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    running_.store(false, std::memory_order_relaxed);
  }
  cv_.notify_all();
  if (thread_.joinable()) thread_.join();
}

bool AudioSource::Seek(uint64_t frame) {
  if (running_.load(std::memory_order_relaxed) || reader_ == nullptr) {
    return false;
  }
  if (!reader_->SeekToFrame(frame)) return false;
  ring_.Clear();
  input_exhausted_.store(false, std::memory_order_relaxed);
  end_of_stream_.store(false, std::memory_order_relaxed);
  position_.store(frame, std::memory_order_relaxed);
  return true;
}

void AudioSource::Close() {
  Stop();
  reader_ = nullptr;
  channels_.store(0, std::memory_order_relaxed);
  sample_rate_ = 0;
}

uint32_t AudioSource::Read(float* dst, uint32_t frames) {
  const uint32_t channels = channels_.load(std::memory_order_relaxed);
  if (channels == 0) return 0;
  const size_t want = static_cast<size_t>(frames) * channels;
  const size_t got = ring_.Read(dst, want);
  position_.fetch_add(got / channels, std::memory_order_relaxed);
  if (got == want) return frames;

  std::fill(dst + got, dst + want, 0.0F);
  if (!input_exhausted_.load(std::memory_order_acquire)) {
    underruns_.fetch_add(1, std::memory_order_relaxed);
  }
  return static_cast<uint32_t>(got / channels);
}

bool AudioSource::is_at_end() const {
  // Load the flag first: its acquire pairs with the reader thread's release, so
  // the head index published with the final chunk is visible to the
  // read_available() below and a ring that looks drained really is.
  const bool ended = end_of_stream_.load(std::memory_order_acquire);
  return ended && ring_.read_available() == 0;
}

void AudioSource::RefillLoop() {
  while (running_.load(std::memory_order_relaxed)) {
    if (end_of_stream_.load(std::memory_order_relaxed)) {
      WaitForStop();
    } else if (!RefillOnce()) {
      WaitForSpace();
    }
  }
}

// Returns true when it moved audio, which is the signal to try again at once
// rather than sleep.
bool AudioSource::RefillOnce() {
  const size_t chunk = staging_.size();
  if (ring_.write_available() < chunk) return false;

  const ReadResult result = reader_->ReadFrames(staging_.data(), chunk_frames_);
  const bool ending = result.status == ReadStatus::kEndOfStream;
  // Before the write: a Read landing between the two must not count the last
  // partial block as an underrun. Not covered by the suite — that interleaving
  // is a few instructions wide and is not deterministically reachable through
  // the public interface, so folding these two flags back into one would keep
  // every check green. Do not.
  if (ending) input_exhausted_.store(true, std::memory_order_release);
  const size_t produced = static_cast<size_t>(result.frames) *
                          channels_.load(std::memory_order_relaxed);
  if (produced > 0) ring_.Write(staging_.data(), produced);
  if (ending) {
    // After the write, and release: is_at_end() must not fire while the final
    // chunk is still in flight.
    end_of_stream_.store(true, std::memory_order_release);
  }
  return produced > 0;
}

void AudioSource::WaitForSpace() {
  std::unique_lock<std::mutex> lock(mutex_);
  cv_.wait_for(lock, kRefillPollInterval, [this] {
    return !running_.load(std::memory_order_relaxed);
  });
}

// Past end of stream there is nothing left to poll for, so the thread parks
// instead of waking every kRefillPollInterval until Stop.
void AudioSource::WaitForStop() {
  std::unique_lock<std::mutex> lock(mutex_);
  cv_.wait(lock, [this] { return !running_.load(std::memory_order_relaxed); });
}

}  // namespace kitbag
