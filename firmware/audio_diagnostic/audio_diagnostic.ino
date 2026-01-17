/*
 * audio_diagnostic.ino
 * Standalone diagnostic for I2S/MAX98357A engine audio testing
 * 
 * Tests without RC receiver - simulates throttle via serial commands
 * 
 * NOTE: High-pass filtering is applied OFFLINE using circular FFT 
 * in build/audio/make_engine_filtered_fft.py to guarantee click-free looping.
 * 
 * Serial Commands:
 *   0-9: Set throttle 0-100% (0=idle, 9=full)
 *   a: Auto sweep mode (slow ramp up/down)
 *   r: Rev test (snap throttle up)
 *   s: Stop/idle
 *   i: Print info/status
 *   f: Toggle FILTERED (FFT offline) vs RAW (unfiltered)
 */

#include "driver/i2s.h"
#include "engine_pcm.h"      // FFT-filtered PCM data
#include "engine_pcm_raw.h"  // Raw unfiltered PCM data

// I2S Configuration
#define I2S_NUM           I2S_NUM_0
#define I2S_SAMPLE_RATE   44100
#define I2S_BUFFER_SIZE   512
#define I2S_BCLK_PIN      25
#define I2S_LRC_PIN       22
#define I2S_DIN_PIN       23

// Tuning parameters
#define THROTTLE_SMOOTH_ALPHA   0.15f
#define RATE_MIN                0.8f
#define RATE_MAX                1.5f
#define GAIN_MIN                0.6f    // Lower gain at idle
#define GAIN_MAX                1.0f    // Normal gain progression (idle -> full)
#define REV_BOOST_RATE          1.25f
#define REV_BOOST_GAIN          1.4f
#define REV_DECAY_MS            400
#define REV_THRESHOLD           0.15f
#define REV_RAMP_MS             150

#define START_FADE_MS           10      // 10ms startup fade-in to prevent initial pop

// Audio engine state
typedef struct {
  float position;
  float rate;
  float gain;
  float smoothed_throttle;
  float prev_throttle;
  uint32_t rev_timer_ms;
  uint32_t last_update_ms;
  uint32_t startup_fade_remaining;
} EngineAudioState;

EngineAudioState engineState;
float simulated_throttle = 0.0f;
bool auto_sweep_mode = false;
unsigned long last_sweep_update = 0;
bool use_filtered = true;

// Linear interpolation
static inline float audioLerp(float a, float b, float t) {
  return a + (b - a) * t;
}

// Soft clip using tanh - prevents harsh clipping artifacts
static inline float softClip(float x) {
  const float max_val = 32767.0f;
  const float k = 2.0f;
  float normalized = x / max_val;
  return (tanh(k * normalized) / tanh(k)) * max_val;
}

// Initialize audio engine
void audioEngine_init() {
  engineState.position = 0.0f;
  engineState.rate = 1.0f;
  engineState.gain = GAIN_MIN;
  engineState.smoothed_throttle = 0.0f;
  engineState.prev_throttle = 0.0f;
  engineState.rev_timer_ms = 0;
  engineState.last_update_ms = millis();
  engineState.startup_fade_remaining = (uint32_t)(I2S_SAMPLE_RATE * START_FADE_MS / 1000);
}

// Update throttle
void audioEngine_updateThrottle(float throttle_normalized) {
  if (throttle_normalized < 0.0f) throttle_normalized = 0.0f;
  if (throttle_normalized > 1.0f) throttle_normalized = 1.0f;
  
  uint32_t current_ms = millis();
  uint32_t delta_ms = current_ms - engineState.last_update_ms;
  engineState.last_update_ms = current_ms;
  
  float throttle_delta = throttle_normalized - engineState.prev_throttle;
  if (throttle_delta > REV_THRESHOLD) {
    engineState.rev_timer_ms = REV_DECAY_MS + REV_RAMP_MS;
  }
  engineState.prev_throttle = throttle_normalized;
  
  if (engineState.rev_timer_ms > 0) {
    if (delta_ms >= engineState.rev_timer_ms) engineState.rev_timer_ms = 0;
    else engineState.rev_timer_ms -= delta_ms;
  }
  
  float smooth_alpha = (engineState.rev_timer_ms > 0) ? 0.35f : THROTTLE_SMOOTH_ALPHA;
  engineState.smoothed_throttle = engineState.smoothed_throttle * (1.0f - smooth_alpha) + throttle_normalized * smooth_alpha;
  
  float base_rate = RATE_MIN + engineState.smoothed_throttle * (RATE_MAX - RATE_MIN);
  float base_gain = GAIN_MIN + engineState.smoothed_throttle * (GAIN_MAX - GAIN_MIN);
  
  if (engineState.rev_timer_ms > 0) {
    float total_time = REV_DECAY_MS + REV_RAMP_MS;
    float rev_elapsed = total_time - engineState.rev_timer_ms;
    float rev_amount = (rev_elapsed < REV_RAMP_MS) ? (rev_elapsed / REV_RAMP_MS) : (1.0f - ((rev_elapsed - REV_RAMP_MS) / REV_DECAY_MS));
    base_rate *= 1.0f + (REV_BOOST_RATE - 1.0f) * rev_amount;
    base_gain *= 1.0f + (REV_BOOST_GAIN - 1.0f) * rev_amount;
  }
  
  engineState.rate = base_rate;
  engineState.gain = base_gain;
}

// Render samples
void audioEngine_renderSamples(int16_t* buffer, size_t count) {
  const int16_t* pcm_data = use_filtered ? ENGINE_PCM_DATA : ENGINE_PCM_RAW_DATA;
  uint32_t pcm_length = use_filtered ? ENGINE_PCM_LENGTH : ENGINE_PCM_RAW_LENGTH;
  
  for (size_t i = 0; i < count; i++) {
    uint32_t idx = (uint32_t)engineState.position;
    float frac = engineState.position - (float)idx;
    
    // Simple wrap (FFT filtering ensures periodic continuity)
    if (idx >= pcm_length) {
      engineState.position = frac;
      idx = 0;
    }
    
    int16_t sample0 = pcm_data[idx];
    int16_t sample1 = pcm_data[(idx + 1) % pcm_length];
    
    float interpolated = audioLerp((float)sample0, (float)sample1, frac);
    interpolated *= engineState.gain;

    // Startup/Mode fade-in
    if (engineState.startup_fade_remaining > 0) {
      float progress = 1.0f - ((float)engineState.startup_fade_remaining / (I2S_SAMPLE_RATE * START_FADE_MS / 1000));
      interpolated *= progress;
      engineState.startup_fade_remaining--;
    }
    
    buffer[i] = (int16_t)softClip(interpolated);
    engineState.position += engineState.rate;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ENGINE AUDIO DIAGNOSTIC (FFT CIRCULAR FILTERING) ===");
  Serial.println("Using FFT-domain filtering to guarantee seamless loop boundaries.");
  setupI2S();
  audioEngine_init();
  setupAudioTask();
  printHelp();
}

void loop() {
  if (Serial.available()) handleCommand(Serial.read());
  if (auto_sweep_mode && millis() - last_sweep_update > 50) {
    last_sweep_update = millis();
    simulated_throttle = (sin(millis() / 5000.0f) + 1.0f) / 2.0f;
  }
  delay(10);
}

void handleCommand(char cmd) {
  if (cmd >= '0' && cmd <= '9') {
    auto_sweep_mode = false;
    simulated_throttle = (cmd - '0') / 9.0f;
    Serial.printf("Throttle: %.0f%%\n", simulated_throttle * 100);
  } else if (cmd == 'a') {
    auto_sweep_mode = !auto_sweep_mode;
    Serial.printf("Auto Sweep: %s\n", auto_sweep_mode ? "ON" : "OFF");
  } else if (cmd == 'r') {
    auto_sweep_mode = false;
    float prev = simulated_throttle;
    simulated_throttle = min(1.0f, prev + 0.4f);
    Serial.printf("Rev: %.0f%% -> %.0f%%\n", prev * 100, simulated_throttle * 100);
  } else if (cmd == 's') {
    auto_sweep_mode = false;
    simulated_throttle = 0.0f;
    Serial.println("Stopped");
  } else if (cmd == 'f' || cmd == 'F') {
    use_filtered = !use_filtered;
    engineState.startup_fade_remaining = (uint32_t)(I2S_SAMPLE_RATE * START_FADE_MS / 1000);
    Serial.printf("Audio Mode: %s\n", use_filtered ? "FILTERED (FFT Circular)" : "RAW");
  } else if (cmd == 'i') {
    printStatus();
  } else if (cmd == 'h' || cmd == '?') {
    printHelp();
  }
}

void printHelp() {
  Serial.println("0-9: Throttle | a: Sweep | r: Rev | s: Idle | f: Toggle Filter | i: Status");
}

void printStatus() {
  Serial.printf("Mode: %s | Throttle: %.3f | Rate: %.3f | Gain: %.3f | Rev: %s\n", 
    use_filtered ? "FILTERED" : "RAW",
    simulated_throttle, engineState.rate, engineState.gain, engineState.rev_timer_ms > 0 ? "YES" : "no");
}

void setupI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = I2S_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = I2S_BUFFER_SIZE,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCLK_PIN,
    .ws_io_num = I2S_LRC_PIN,
    .data_out_num = I2S_DIN_PIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };
  i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM);
  Serial.println("✓ I2S Ready");
}

void audioTaskFunction(void* param) {
  int16_t audio_buffer[I2S_BUFFER_SIZE];
  size_t written;
  while (true) {
    audioEngine_updateThrottle(simulated_throttle);
    audioEngine_renderSamples(audio_buffer, I2S_BUFFER_SIZE);
    i2s_write(I2S_NUM, audio_buffer, I2S_BUFFER_SIZE * 2, &written, portMAX_DELAY);
  }
}

void setupAudioTask() {
  xTaskCreatePinnedToCore(audioTaskFunction, "AudioEngine", 4096, NULL, 5, NULL, 1);
  Serial.println("✓ Task Ready");
}
