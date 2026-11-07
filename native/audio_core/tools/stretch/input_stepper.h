#ifndef KITBAG_TOOLS_STRETCH_INPUT_STEPPER_H
#define KITBAG_TOOLS_STRETCH_INPUT_STEPPER_H

namespace stretch_test {

class InputStepper {
 public:
  InputStepper(double rate, int out_frames)
      : rate_(rate), out_frames_(out_frames) {}

  int Next() {
    const double wanted = rate_ * out_frames_ + carry_;
    const int take = static_cast<int>(wanted);
    carry_ = wanted - take;
    return take;
  }

 private:
  double rate_;
  int out_frames_;
  double carry_ = 0.0;
};

}  // namespace stretch_test

#endif  // KITBAG_TOOLS_STRETCH_INPUT_STEPPER_H
