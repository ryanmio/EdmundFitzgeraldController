/*
 * audio_diagnostic.ino
 * Standalone diagnostic for I2S/MAX98357A engine audio testing
 * 
 * Tests without RC receiver - simulates throttle via serial commands
 * Includes embedded audio engine (no linking issues)
 * 
 * Serial Commands:
 *   0-9: Set throttle 0-100% (0=idle, 9=full)
 *   a: Auto sweep mode (slow ramp up/down)
 *   r: Rev test (snap throttle up)
 *   s: Stop/idle
 *   i: Print info/status
 *   f: Toggle filter (compare filtered vs raw audio)
 */

#include "driver/i2s.h"
#include "engine_pcm.h"      // Filtered PCM (with anti-aliasing)
#include "engine_pcm_raw.h"  // Raw PCM (minimal processing)

// I2S Configuration
#define I2S_NUM           I2S_NUM_0
#define I2S_SAMPLE_RATE   44100
#define I2S_BUFFER_SIZE   512
#define I2S_BCLK_PIN      25
#define I2S_LRC_PIN       22
#define I2S_DIN_PIN       23

// ==================== EMBEDDED AUDIO ENGINE ====================
// Tuning parameters
#define THROTTLE_SMOOTH_ALPHA   0.15f
#define RATE_MIN                0.8f
#define RATE_MAX                1.5f
#define GAIN_MIN                1.2f    // Loud even at idle
#define GAIN_MAX                1.8f    // Maximum safe gain
#define REV_BOOST_RATE          1.25f   // 25% pitch boost (was 1.1)
#define REV_BOOST_GAIN          1.4f    // 40% volume boost (was 1.2)
#define REV_DECAY_MS            400     // Longer decay (was 300)
#define REV_THRESHOLD           0.15f
#define REV_RAMP_MS             150     // Ramp-in time (was 100)

// Audio engine state
typedef struct {
  float position;
  float rate;
  float gain;
  float smoothed_throttle;
  float prev_throttle;
  uint32_t rev_timer_ms;
  uint32_t last_update_ms;
  float hp_prev_in;   // High-pass filter state
  float hp_prev_out;
} EngineAudioState;

EngineAudioState engineState;

// Linear interpolation (audioLerp to avoid std::lerp conflict)
static inline float audioLerp(float a, float b, float t) {
  return a + (b - a) * t;
}

// ==================== TEST MODE ====================
float simulated_throttle = 0.0f;
bool auto_sweep_mode = false;
unsigned long last_sweep_update = 0;
bool use_filtered = true;  // Toggle between filtered and raw audio

// Initialize audio engine
void audioEngine_init() {
  engineState.position = 0.0f;
  engineState.rate = 1.0f;
  engineState.gain = GAIN_MIN;
  engineState.smoothed_throttle = 0.0f;
  engineState.prev_throttle = 0.0f;
  engineState.rev_timer_ms = 0;
  engineState.last_update_ms = millis();
  engineState.hp_prev_in = 0.0f;
  engineState.hp_prev_out = 0.0f;
}

// Update throttle
void audioEngine_updateThrottle(float throttle_normalized) {
  if (throttle_normalized < 0.0f) throttle_normalized = 0.0f;
  if (throttle_normalized > 1.0f) throttle_normalized = 1.0f;
  
  uint32_t current_ms = millis();
  uint32_t delta_ms = current_ms - engineState.last_update_ms;
  engineState.last_update_ms = current_ms;
  
  // Detect rev transient (rapid throttle increase)
  float throttle_delta = throttle_normalized - engineState.prev_throttle;
  if (throttle_delta > REV_THRESHOLD) {
    engineState.rev_timer_ms = REV_DECAY_MS + REV_RAMP_MS;
  }
  engineState.prev_throttle = throttle_normalized;
  
  // Decay rev timer
  if (engineState.rev_timer_ms > 0) {
    if (delta_ms >= engineState.rev_timer_ms) {
      engineState.rev_timer_ms = 0;
    } else {
      engineState.rev_timer_ms -= delta_ms;
    }
  }
  
  // Apply faster smoothing during rev transient for more responsive feel
  float smooth_alpha = THROTTLE_SMOOTH_ALPHA;
  if (engineState.rev_timer_ms > 0) {
    smooth_alpha = 0.35f;  // Much faster response during rev
  }
  
  engineState.smoothed_throttle = 
    engineState.smoothed_throttle * (1.0f - smooth_alpha) +
    throttle_normalized * smooth_alpha;
  
  float base_rate = RATE_MIN + engineState.smoothed_throttle * (RATE_MAX - RATE_MIN);
  float base_gain = GAIN_MIN + engineState.smoothed_throttle * (GAIN_MAX - GAIN_MIN);
  
  // Apply rev boost if active (ramp-in then decay for realistic effect)
  if (engineState.rev_timer_ms > 0) {
    float total_time = REV_DECAY_MS + REV_RAMP_MS;
    float rev_elapsed = total_time - engineState.rev_timer_ms;
    
    float rev_amount = 0.0f;
    if (rev_elapsed < REV_RAMP_MS) {
      // Ramp-in phase: smoothly increase rev effect
      rev_amount = rev_elapsed / REV_RAMP_MS;
    } else {
      // Decay phase: gradually fade rev effect
      float decay_elapsed = rev_elapsed - REV_RAMP_MS;
      rev_amount = 1.0f - (decay_elapsed / REV_DECAY_MS);
    }
    
    base_rate *= 1.0f + (REV_BOOST_RATE - 1.0f) * rev_amount;
    base_gain *= 1.0f + (REV_BOOST_GAIN - 1.0f) * rev_amount;
  }
  
  engineState.rate = base_rate;
  engineState.gain = base_gain;
}

// High-pass filter to remove bass frequencies that cause speaker rattling
// More aggressive 1st order HPF at ~400Hz - cuts more bass for tiny speakers
static inline float highPassFilter(float input) {
  const float alpha = 0.94f;  // ~400Hz cutoff at 44.1kHz (was 0.98/150Hz)
  
  float output = alpha * (engineState.hp_prev_out + input - engineState.hp_prev_in);
  
  engineState.hp_prev_in = input;
  engineState.hp_prev_out = output;
  
  return output;
}

// Render samples
void audioEngine_renderSamples(int16_t* buffer, size_t count) {
  // Select which PCM array to use
  const int16_t* pcm_data = use_filtered ? ENGINE_PCM_DATA : ENGINE_PCM_RAW_DATA;
  uint32_t pcm_length = use_filtered ? ENGINE_PCM_LENGTH : ENGINE_PCM_RAW_LENGTH;
  
  for (size_t i = 0; i < count; i++) {
    uint32_t idx = (uint32_t)engineState.position;
    float frac = engineState.position - (float)idx;
    
    if (idx >= pcm_length) {
      idx = idx % pcm_length;
      engineState.position = (float)idx + frac;
    }
    
    int16_t sample0 = pcm_data[idx];
    int16_t sample1 = pcm_data[(idx + 1) % pcm_length];
    
    float interpolated = audioLerp((float)sample0, (float)sample1, frac);
    
    // Apply high-pass filter ONLY if using filtered version
    if (use_filtered) {
      interpolated = highPassFilter(interpolated);
    }
    
    // Apply gain
    interpolated *= engineState.gain;
    
    // Simple clipping
    if (interpolated > 32767.0f) interpolated = 32767.0f;
    if (interpolated < -32768.0f) interpolated = -32768.0f;
    
    buffer[i] = (int16_t)interpolated;
    
    engineState.position += engineState.rate;
  }
}

// Getters for status
float audioEngine_getRate() { return engineState.rate; }
float audioEngine_getGain() { return engineState.gain; }
float audioEngine_getSmoothedThrottle() { return engineState.smoothed_throttle; }
bool audioEngine_isRevActive() { return engineState.rev_timer_ms > 0; }

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("  ENGINE AUDIO DIAGNOSTIC TEST");
  Serial.println("========================================");
  Serial.println();
  
  // Initialize I2S
  Serial.println("[1/3] Initializing I2S for MAX98357A...");
  setupI2S();
  
  // Initialize audio engine
  Serial.println("[2/3] Initializing audio engine...");
  audioEngine_init();
  
  // Start audio task
  Serial.println("[3/3] Starting audio task on Core 1...");
  setupAudioTask();
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("  DIAGNOSTIC READY");
  Serial.println("========================================");
  Serial.println();
  printHelp();
}

void loop() {
  // Check for serial commands
  if (Serial.available()) {
    char cmd = Serial.read();
    handleCommand(cmd);
  }
  
  // Auto sweep mode
  if (auto_sweep_mode && millis() - last_sweep_update > 50) {
    last_sweep_update = millis();
    
    // Slow sine wave sweep
    float t = millis() / 5000.0f;  // 5 second period
    simulated_throttle = (sin(t) + 1.0f) / 2.0f;  // 0.0 to 1.0
  }
  
  delay(10);
}

void handleCommand(char cmd) {
  switch (cmd) {
    case '0': case '1': case '2': case '3': case '4':
    case '5': case '6': case '7': case '8': case '9':
      auto_sweep_mode = false;
      simulated_throttle = (cmd - '0') / 9.0f;
      Serial.printf("Throttle set to %.0f%% (%.2f)\n", simulated_throttle * 100, simulated_throttle);
      printStatus();
      break;
      
    case 'a':
    case 'A':
      auto_sweep_mode = !auto_sweep_mode;
      Serial.printf("Auto sweep mode: %s\n", auto_sweep_mode ? "ON" : "OFF");
      if (auto_sweep_mode) {
        Serial.println("  (Throttle will slowly ramp 0-100% in a loop)");
      }
      break;
      
    case 'r':
    case 'R':
      auto_sweep_mode = false;
      {
        float prev = simulated_throttle;
        simulated_throttle = prev + 0.4f;  // Add 40% throttle
        if (simulated_throttle > 1.0f) simulated_throttle = 1.0f;
        Serial.printf("Rev test: %.0f%% -> %.0f%% snap\n", prev * 100, simulated_throttle * 100);
      }
      printStatus();
      break;
      
    case 's':
    case 'S':
      auto_sweep_mode = false;
      simulated_throttle = 0.0f;
      Serial.println("Throttle stopped (idle)");
      printStatus();
      break;
      
    case 'i':
    case 'I':
      printStatus();
      break;
      
    case 'f':
    case 'F':
      use_filtered = !use_filtered;
      // Reset filter state when switching
      engineState.hp_prev_in = 0.0f;
      engineState.hp_prev_out = 0.0f;
      Serial.println("========================================");
      Serial.printf("Audio mode: %s\n", use_filtered ? "FILTERED (400Hz HPF + low-pass)" : "RAW (minimal processing)");
      Serial.println("========================================");
      if (!use_filtered) {
        Serial.println("WARNING: Raw audio may rattle on small speakers!");
      }
      printStatus();
      break;
      
    case 'h':
    case 'H':
    case '?':
      printHelp();
      break;
      
    case '\n':
    case '\r':
      // Ignore newlines
      break;
      
    default:
      Serial.printf("Unknown command: '%c' (press 'h' for help)\n", cmd);
      break;
  }
}

void printHelp() {
  Serial.println("COMMANDS:");
  Serial.println("  0-9  Set throttle (0=idle, 9=full throttle)");
  Serial.println("  a    Toggle auto sweep mode (slow ramp)");
  Serial.println("  r    Rev test (snap throttle)");
  Serial.println("  s    Stop/idle");
  Serial.println("  f    Toggle filter (compare filtered vs raw audio)");
  Serial.println("  i    Print current status");
  Serial.println("  h/?  Show this help");
  Serial.println();
}

void printStatus() {
  Serial.println("----------------------------------------");
  Serial.printf("Audio Mode:    %s\n", use_filtered ? "FILTERED" : "RAW");
  Serial.printf("Throttle:      %.1f%% (%.3f normalized)\n", 
    simulated_throttle * 100, simulated_throttle);
  Serial.printf("Smoothed:      %.3f\n", audioEngine_getSmoothedThrottle());
  Serial.printf("Engine Rate:   %.3f (pitch)\n", audioEngine_getRate());
  Serial.printf("Engine Gain:   %.3f (volume)\n", audioEngine_getGain());
  Serial.printf("Rev Active:    %s\n", audioEngine_isRevActive() ? "YES" : "no");
  Serial.printf("Auto Sweep:    %s\n", auto_sweep_mode ? "ON" : "off");
  
  // Memory info
  Serial.printf("Free Heap:     %u bytes (%.1f KB)\n", 
    ESP.getFreeHeap(), ESP.getFreeHeap() / 1024.0f);
  Serial.println("----------------------------------------");
}

// Initialize I2S driver
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
  
  esp_err_t err = i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("  ERROR: I2S install failed: %d\n", err);
    return;
  }
  
  err = i2s_set_pin(I2S_NUM, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("  ERROR: I2S pin config failed: %d\n", err);
    return;
  }
  
  i2s_zero_dma_buffer(I2S_NUM);
  
  Serial.println("  ✓ I2S initialized");
  Serial.printf("    Sample rate: %d Hz\n", I2S_SAMPLE_RATE);
  Serial.printf("    Pins: BCLK=%d, LRC=%d, DIN=%d\n", 
    I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DIN_PIN);
}

// Audio task function
void audioTaskFunction(void* param) {
  int16_t audio_buffer[I2S_BUFFER_SIZE];
  size_t bytes_written;
  
  Serial.println("  ✓ Audio task started on Core 1");
  
  while (true) {
    // Update engine with simulated throttle
    audioEngine_updateThrottle(simulated_throttle);
    
    // Render samples
    audioEngine_renderSamples(audio_buffer, I2S_BUFFER_SIZE);
    
    // Write to I2S
    i2s_write(I2S_NUM, audio_buffer, I2S_BUFFER_SIZE * 2, &bytes_written, portMAX_DELAY);
  }
}

// Create audio task
void setupAudioTask() {
  xTaskCreatePinnedToCore(
    audioTaskFunction,
    "AudioEngine",
    4096,
    NULL,
    5,
    NULL,
    1  // Core 1
  );
  
  Serial.println("  ✓ Audio task created (Core 1, priority 5)");
}
