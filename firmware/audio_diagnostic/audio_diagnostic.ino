/*
 * audio_diagnostic.ino
 * Standalone diagnostic for I2S/MAX98357A engine audio testing
 * 
 * Tests without RC receiver - simulates throttle via serial commands
 * 
 * Serial Commands:
 *   0-9: Set throttle 0-100% (0=idle, 9=full)
 *   a: Auto sweep mode (slow ramp up/down)
 *   r: Rev test (snap throttle up)
 *   s: Stop/idle
 *   i: Print info/status
 */

#include "driver/i2s.h"
#include "../boat_telemetry/audio_engine.h"  // Reuse audio engine

// I2S Configuration
#define I2S_NUM           I2S_NUM_0
#define I2S_SAMPLE_RATE   22050
#define I2S_BUFFER_SIZE   512
#define I2S_BCLK_PIN      25
#define I2S_LRC_PIN       22
#define I2S_DIN_PIN       23

// Test mode state
float simulated_throttle = 0.0f;
bool auto_sweep_mode = false;
unsigned long last_sweep_update = 0;

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
      Serial.println("Rev test: 0% -> 80% snap");
      simulated_throttle = 0.0f;
      delay(500);
      simulated_throttle = 0.8f;
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
  Serial.println("  i    Print current status");
  Serial.println("  h/?  Show this help");
  Serial.println();
}

void printStatus() {
  Serial.println("----------------------------------------");
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
