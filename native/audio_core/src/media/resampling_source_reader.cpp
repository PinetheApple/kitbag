#include "media/resampling_source_reader.h"

#include <vector>

#include "miniaudio.h"

namespace kitbag {

namespace {
// One decode call's worth of input staging; refilled as the converter drains
// it. Off the audio thread, so its size is a throughput knob, not a latency one.
constexpr uint32_t kInputStageFrames = 512;
}  // namespace

struct ResamplingSourceReader::Impl {
  SourceReader* inner = nullptr;
  ma_data_converter converter{};
  bool ok = false;
  uint32_t channels = 0;
  uint32_t in_rate = 0;
  uint32_t out_rate = 0;
  uint64_t out_total = 0;
  std::vector<float> in_buf;  // read-ahead thread only
  uint64_t in_avail = 0;      // frames staged but not yet fed
  uint64_t in_pos = 0;        // frames already fed from in_buf
  bool in_ended = false;

  void Init() {
    if (channels == 0 || in_rate == 0 || out_rate == 0) return;
    ma_data_converter_config cfg = ma_data_converter_config_init(
        ma_format_f32,
        ma_format_f32,
        channels,
        channels,
        in_rate,
        out_rate
    );
    cfg.resampling.algorithm = ma_resample_algorithm_linear;
    if (ma_data_converter_init(&cfg, nullptr, &converter) != MA_SUCCESS) return;
    in_buf.assign(static_cast<size_t>(kInputStageFrames) * channels, 0.0F);
    ma_uint64 expected = 0;
    ma_data_converter_get_expected_output_frame_count(
        &converter,
        inner->total_frames(),
        &expected
    );
    out_total = expected;
    ok = true;
  }

  void RefillInput() {
    const ReadResult r = inner->ReadFrames(in_buf.data(), kInputStageFrames);
    in_avail = r.frames;
    in_pos = 0;
    if (r.status == ReadStatus::kEndOfStream) in_ended = true;
  }
};

ResamplingSourceReader::ResamplingSourceReader(
    SourceReader* inner,
    uint32_t out_rate
)
    : impl_(std::make_unique<Impl>()) {
  impl_->inner = inner;
  impl_->channels = inner->channels();
  impl_->in_rate = inner->sample_rate();
  impl_->out_rate = out_rate;
  impl_->Init();
}

ResamplingSourceReader::~ResamplingSourceReader() {
  if (impl_->ok) ma_data_converter_uninit(&impl_->converter, nullptr);
}

bool ResamplingSourceReader::ok() const {
  return impl_->ok;
}

uint32_t ResamplingSourceReader::channels() const {
  return impl_->channels;
}

uint32_t ResamplingSourceReader::sample_rate() const {
  return impl_->out_rate;
}

uint64_t ResamplingSourceReader::total_frames() const {
  return impl_->out_total;
}

ReadResult ResamplingSourceReader::ReadFrames(float* dst, uint64_t frames) {
  const uint32_t ch = impl_->channels;
  uint64_t out_done = 0;
  while (out_done < frames) {
    if (impl_->in_avail == 0 && !impl_->in_ended) impl_->RefillInput();
    // Once the input is spent the linear converter cannot produce more without
    // a next frame to interpolate toward, so end here rather than emit silence.
    // This leaves total delivered <= total_frames() by ~1 held tail frame.
    if (impl_->in_avail == 0 && impl_->in_ended) break;

    ma_uint64 in_n = impl_->in_avail;
    ma_uint64 out_n = frames - out_done;
    ma_data_converter_process_pcm_frames(
        &impl_->converter,
        impl_->in_buf.data() + impl_->in_pos * ch,
        &in_n,
        dst + out_done * ch,
        &out_n
    );
    impl_->in_pos += in_n;
    impl_->in_avail -= in_n;
    out_done += out_n;
    if (in_n == 0 && out_n == 0) break;  // no progress; avoid a spin
  }
  const ReadStatus st =
      out_done < frames ? ReadStatus::kEndOfStream : ReadStatus::kOk;
  return {out_done, st};
}

bool ResamplingSourceReader::SeekToFrame(uint64_t frame) {
  const uint64_t in_frame =
      impl_->out_rate == 0 ? frame : frame * impl_->in_rate / impl_->out_rate;
  if (!impl_->inner->SeekToFrame(in_frame)) return false;
  ma_data_converter_reset(&impl_->converter);
  impl_->in_avail = 0;
  impl_->in_pos = 0;
  impl_->in_ended = false;
  return true;
}

}  // namespace kitbag
