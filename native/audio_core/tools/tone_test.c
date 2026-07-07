#include <stdio.h>
#include <unistd.h>

#include "kitbag_api.h"

/* Plays a 440 Hz test tone for two seconds. Manual smoke test for the core. */
int main(void) {
  kb_engine* engine = NULL;

  kb_result result = kb_engine_create(&engine);
  if (result != KB_OK) {
    fprintf(stderr, "engine create failed: %d\n", result);
    return 1;
  }
  printf("kitbag_core %s · sample rate %u Hz\n", kb_version(),
         kb_engine_sample_rate(engine));

  result = kb_engine_start(engine);
  if (result != KB_OK) {
    fprintf(stderr, "engine start failed: %d\n", result);
    kb_engine_destroy(engine);
    return 1;
  }

  kb_engine_set_test_tone(engine, 1, 440.0f);
  sleep(2);
  kb_engine_set_test_tone(engine, 0, 0.0f);

  printf("frames rendered: %llu\n",
         (unsigned long long)kb_engine_frames_rendered(engine));

  kb_engine_stop(engine);
  kb_engine_destroy(engine);
  return 0;
}
