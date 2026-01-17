/*
 * i2s_silence_test.ino
 * ULTRA BASIC: Just output silence (all zeros)
 * If this produces silence, wiring is OK
 * If this produces noise, there's a deeper issue
 */

#include "driver/i2s.h"

#define I2S_NUM           I2S_NUM_0
#define I2S_SAMPLE_RATE   22050
#define I2S_BUFFER_SIZE   512
#define I2S_BCLK_PIN      25
#define I2S_LRC_PIN       22
#define I2S_DIN_PIN       23

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== I2S SILENCE TEST ===\n");
  
  // Initialize I2S
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
  
  Serial.println("I2S initialized");
  Serial.println("Sample rate: 22050 Hz");
  Serial.printf("Pins: BCLK=%d, LRC=%d, DIN=%d\n\n", I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DIN_PIN);
  
  Serial.println("TEST: Writing silence (all zeros) to I2S");
  Serial.println("Expected: COMPLETE SILENCE");
  Serial.println("If you hear noise: Wiring or hardware issue\n");
  
  xTaskCreatePinnedToCore(silenceTaskFunction, "Silence", 4096, NULL, 5, NULL, 1);
}

void loop() {
  delay(1000);
  Serial.print(".");  // Heartbeat
}

void silenceTaskFunction(void* param) {
  int16_t silence_buffer[I2S_BUFFER_SIZE];
  size_t bytes_written;
  
  // Fill buffer with zeros
  memset(silence_buffer, 0, sizeof(silence_buffer));
  
  Serial.println("Silence task started - streaming zeros to I2S\n");
  
  while (true) {
    i2s_write(I2S_NUM, silence_buffer, I2S_BUFFER_SIZE * 2, &bytes_written, portMAX_DELAY);
  }
}
