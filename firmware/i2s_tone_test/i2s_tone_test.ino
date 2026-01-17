/*
 * i2s_tone_test.ino
 * Generate clean sine wave tones to test I2S/MAX98357A hardware
 * No PCM data dependency - pure math-generated audio
 * 
 * Serial Commands:
 *   1: 440 Hz (A note)
 *   2: 880 Hz (A higher octave)
 *   3: 220 Hz (A lower octave)
 *   4: 1000 Hz (1kHz test tone)
 *   0: Stop/silence
 *   i: Print info
 */

#include "driver/i2s.h"
#include <math.h>

#define I2S_NUM           I2S_NUM_0
#define I2S_SAMPLE_RATE   22050
#define I2S_BUFFER_SIZE   512
#define I2S_BCLK_PIN      25
#define I2S_LRC_PIN       22
#define I2S_DIN_PIN       23

// Tone generation state
float current_frequency = 0.0f;
float phase = 0.0f;
bool tone_active = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("  I2S TONE TEST - Hardware Verification");
  Serial.println("========================================");
  Serial.println();
  
  Serial.println("[1/2] Initializing I2S for MAX98357A...");
  setupI2S();
  
  Serial.println("[2/2] Starting audio task on Core 1...");
  setupAudioTask();
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("  TONE TEST READY");
  Serial.println("========================================");
  Serial.println();
  printHelp();
}

void loop() {
  if (Serial.available()) {
    char cmd = Serial.read();
    handleCommand(cmd);
  }
  delay(10);
}

void handleCommand(char cmd) {
  switch (cmd) {
    case '0':
      tone_active = false;
      current_frequency = 0.0f;
      phase = 0.0f;
      Serial.println("Tone stopped (silence)");
      break;
      
    case '1':
      current_frequency = 440.0f;
      tone_active = true;
      phase = 0.0f;
      Serial.println("Tone: 440 Hz (A note) - Should be musical");
      break;
      
    case '2':
      current_frequency = 880.0f;
      tone_active = true;
      phase = 0.0f;
      Serial.println("Tone: 880 Hz (A higher) - Higher pitch");
      break;
      
    case '3':
      current_frequency = 220.0f;
      tone_active = true;
      phase = 0.0f;
      Serial.println("Tone: 220 Hz (A lower) - Lower pitch");
      break;
      
    case '4':
      current_frequency = 1000.0f;
      tone_active = true;
      phase = 0.0f;
      Serial.println("Tone: 1000 Hz (1kHz test tone)");
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
      break;
      
    default:
      Serial.printf("Unknown command: '%c' (press 'h' for help)\n", cmd);
      break;
  }
}

void printHelp() {
  Serial.println("COMMANDS:");
  Serial.println("  1: 440 Hz sine tone (musical A note)");
  Serial.println("  2: 880 Hz sine tone (higher A)");
  Serial.println("  3: 220 Hz sine tone (lower A)");
  Serial.println("  4: 1000 Hz sine tone (1kHz reference)");
  Serial.println("  0: Stop tone (silence)");
  Serial.println("  i: Print status");
  Serial.println("  h: Show this help");
  Serial.println();
  Serial.println("EXPECTED BEHAVIOR:");
  Serial.println("  - Tones should be clean, musical sine waves");
  Serial.println("  - NO noise, crackle, or static");
  Serial.println("  - Different frequencies should have different pitches");
  Serial.println();
}

void printStatus() {
  Serial.println("----------------------------------------");
  Serial.printf("Tone Active:    %s\n", tone_active ? "YES" : "no");
  Serial.printf("Frequency:      %.1f Hz\n", current_frequency);
  Serial.printf("Phase:          %.4f\n", phase);
  Serial.printf("Free Heap:      %u bytes (%.1f KB)\n", 
    ESP.getFreeHeap(), ESP.getFreeHeap() / 1024.0f);
  Serial.println("----------------------------------------");
}

// Initialize I2S
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

// Audio task - generates sine wave
void audioTaskFunction(void* param) {
  int16_t audio_buffer[I2S_BUFFER_SIZE];
  size_t bytes_written;
  
  Serial.println("  ✓ Audio task started on Core 1");
  
  float phase_increment;
  
  while (true) {
    // Calculate phase increment for current frequency
    if (tone_active && current_frequency > 0.0f) {
      phase_increment = (current_frequency * 2.0f * M_PI) / I2S_SAMPLE_RATE;
    } else {
      phase_increment = 0.0f;
    }
    
    // Generate samples
    for (int i = 0; i < I2S_BUFFER_SIZE; i++) {
      if (tone_active && current_frequency > 0.0f) {
        // Generate sine wave at 50% volume to be safe
        float sample = sin(phase) * 0.5f;
        audio_buffer[i] = (int16_t)(sample * 32767.0f);
        
        // Advance phase
        phase += phase_increment;
        if (phase > 2.0f * M_PI) {
          phase -= 2.0f * M_PI;
        }
      } else {
        // Silent
        audio_buffer[i] = 0;
      }
    }
    
    // Write to I2S
    i2s_write(I2S_NUM, audio_buffer, I2S_BUFFER_SIZE * 2, &bytes_written, portMAX_DELAY);
  }
}

// Create audio task
void setupAudioTask() {
  xTaskCreatePinnedToCore(
    audioTaskFunction,
    "ToneGenerator",
    4096,
    NULL,
    5,
    NULL,
    1  // Core 1
  );
  
  Serial.println("  ✓ Audio task created (Core 1, priority 5)");
}
