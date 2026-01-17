/*
 * i2s_clock_test.ino
 * Test I2S clocks BEFORE sending data
 * Verifies BCLK and LRC are stable and synchronized
 */

#include "driver/i2s.h"
#include "driver/gpio.h"

#define I2S_NUM           I2S_NUM_0
#define I2S_SAMPLE_RATE   22050
#define I2S_BUFFER_SIZE   512
#define I2S_BCLK_PIN      25
#define I2S_LRC_PIN       22
#define I2S_DIN_PIN       23

void setup() {
  Serial.begin(115200);
  delay(2000);  // Extra delay for serial port
  
  Serial.println("\n\n=== I2S CLOCK TEST ===\n");
  Serial.println("This test:");
  Serial.println("1. Initializes I2S");
  Serial.println("2. Waits 3 seconds for MAX98357A to stabilize");
  Serial.println("3. Then starts sending silence\n");
  
  // Initialize I2S with explicit config
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
    .bck_io_num = I2S_BCLK_PIN,      // Bit clock
    .ws_io_num = I2S_LRC_PIN,        // Word select / Left-Right clock
    .data_out_num = I2S_DIN_PIN,     // Data in
    .data_in_num = I2S_PIN_NO_CHANGE
  };
  
  Serial.println("Installing I2S driver...");
  esp_err_t err = i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("ERROR: i2s_driver_install failed: %d\n", err);
    while(1) delay(1000);
  }
  
  Serial.println("Setting I2S pins...");
  err = i2s_set_pin(I2S_NUM, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("ERROR: i2s_set_pin failed: %d\n", err);
    while(1) delay(1000);
  }
  
  Serial.println("Zeroing DMA buffer...");
  i2s_zero_dma_buffer(I2S_NUM);
  
  Serial.println("\nI2S Initialized:");
  Serial.printf("  Sample rate: %d Hz\n", I2S_SAMPLE_RATE);
  Serial.printf("  BCLK pin: GPIO%d\n", I2S_BCLK_PIN);
  Serial.printf("  LRC pin:  GPIO%d\n", I2S_LRC_PIN);
  Serial.printf("  DIN pin:  GPIO%d\n", I2S_DIN_PIN);
  
  Serial.println("\n⏳ Waiting 3 seconds for MAX98357A to initialize...");
  for (int i = 3; i > 0; i--) {
    Serial.printf("  %d...\n", i);
    delay(1000);
  }
  
  Serial.println("\n✓ Starting audio task to send silence...");
  Serial.println("  If SILENT = Good wiring");
  Serial.println("  If NOISE = Clock/sync issue\n");
  
  xTaskCreatePinnedToCore(audioTaskFunction, "Audio", 4096, NULL, 5, NULL, 1);
}

void loop() {
  delay(1000);
  Serial.print(".");
}

void audioTaskFunction(void* param) {
  int16_t audio_buffer[I2S_BUFFER_SIZE];
  size_t bytes_written;
  
  // Pre-fill with zeros
  memset(audio_buffer, 0, sizeof(audio_buffer));
  
  while (true) {
    // Send silence
    i2s_write(I2S_NUM, audio_buffer, I2S_BUFFER_SIZE * 2, &bytes_written, portMAX_DELAY);
  }
}
