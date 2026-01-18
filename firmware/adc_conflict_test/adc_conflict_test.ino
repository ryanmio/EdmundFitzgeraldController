/*
 * Reproduce exact boat_telemetry setup to isolate ADC conflict
 */

#include <WiFi.h>
#include <WebServer.h>
#include "driver/i2s.h"
#include "driver/rmt.h"

// Global objects (same as boat_telemetry)
WebServer server(80);

// Same I2S config
#define I2S_NUM I2S_NUM_1
#define I2S_SAMPLE_RATE 44100

void setup() {
  // Try ADC FIRST (same as boat_telemetry)
  pinMode(34, INPUT);
  int val = analogRead(34);
  
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Minimal boat_telemetry test ===");
  Serial.printf("ADC read: %d\n", val);
  
  // Now try to init I2S (same as boat_telemetry)
  Serial.println("Initializing I2S...");
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = I2S_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };
  
  esp_err_t err = i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);
  Serial.printf("I2S install result: %d\n", err);
  
  Serial.println("SUCCESS - No crash!");
}

void loop() {
  delay(1000);
}
