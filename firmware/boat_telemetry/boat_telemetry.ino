/*
 * boat_telemetry.ino
 * ESP32 boat telemetry and control system with engine audio
 * Endpoints: /status, /telemetry, /led, /radio, /horn, /sos, /easter-egg, /engine-debug
 */

#include <WiFi.h>
#include <WebServer.h>
#include "secrets.h"
#include "DFRobot_DF1201S.h"   // DFPlayer Pro (DF1201S) library
#include "driver/i2s.h"         // ESP32 I2S driver for MAX98357A
#include "driver/rmt.h"         // ESP32 RMT for PWM capture
#include "audio_engine.h"       // Engine audio sampler

// ==================== PIN DEFINITIONS ====================
#define LED_RUNNING_PIN    2   // Built-in LED on most dev boards (keep for testing)
#define LED_FLOOD_PIN      4   // Flood mode indicator LED (optional)
#define RUNNING_OUT_PIN   16   // External Running lights control (MOSFET gate)
#define FLOOD_OUT_PIN     21   // External Flood lights control (MOSFET gate)
#define BATTERY_ADC_PIN   34   // Battery voltage sense (ADC)
#define WATER_SENSOR_PIN  32   // Water intrusion sensor (digital input with pullup) - GPIO32 has internal pullup, GPIO34/35/36/39 do NOT
#define THROTTLE_PWM_PIN  18   // RC receiver throttle channel (PWM input)
#define SERVO_PWM_PIN     19   // RC receiver servo/rudder channel (PWM input)

// DFPlayer Pro pins (serial communication at 115200 baud)
#define DFPLAYER_RX       27   // ESP32 RX - Connect to DFPlayer TX
#define DFPLAYER_TX       26   // ESP32 TX - Connect to DFPlayer RX

// I2S pins for MAX98357A (engine audio output)
#define I2S_BCLK_PIN      25   // Bit clock
#define I2S_LRC_PIN       22   // Left/Right clock (word select)
#define I2S_DIN_PIN       23   // Data out to MAX98357A

// RMT configuration for throttle PWM capture
#define RMT_RX_CHANNEL    RMT_CHANNEL_0
#define RMT_CLK_DIV       80   // 1 MHz tick rate (80 MHz / 80)

// ==================== BUILD IDENTIFICATION ====================
#define FIRMWARE_VERSION   "3.0.0"
#define BUILD_ID           "20260115-engine-audio"

// ==================== I2S CONFIGURATION ====================
#define I2S_NUM           I2S_NUM_1   // Switch to I2S_NUM_1 to avoid ADC conflict on I2S_NUM_0
#define I2S_SAMPLE_RATE   44100
#define I2S_BUFFER_SIZE   512

// ==================== GLOBALS ====================
WebServer server(80);
DFRobot_DF1201S DF1201S;  // DFPlayer Pro object
unsigned long startTime;
bool ledRunningState = false;
bool ledFloodState = false;
bool dfPlayerAvailable = false;  // Track if DFPlayer is initialized

// RMT throttle capture variables (non-blocking PWM read)
volatile uint32_t throttle_pulse_us = 1500; // Cached throttle value (safe default)
volatile unsigned long last_throttle_update = 0;

// Water sensor debouncing variables
bool waterDebouncedState = false;  // Current debounced state (false = secure, true = breached)
bool waterLastRawState = true;     // Last raw sensor reading (true = DRY, false = WET)
unsigned long waterStateChangeTime = 0;  // Time when current raw state started
const unsigned long WATER_DEBOUNCE_TIME = 10000;  // 10 seconds in milliseconds

// ==================== WIFI CONNECT (SCAN + MATCH) ====================
void connectWiFi() {
  Serial.println();
  Serial.println("Scanning for WiFi networks...");

  WiFi.mode(WIFI_STA);
  int numNetworks = WiFi.scanNetworks();
  
  Serial.print("Scan complete. Networks found: ");
  Serial.println(numNetworks);
  
  String ssidToConnect = "";
  bool foundHomeWiFi = false;
  
  // First pass: look for home WiFi (.hidden network)
  for (int i = 0; i < numNetworks; i++) {
    String scannedSSID = WiFi.SSID(i);
    Serial.print("[");
    Serial.print(i);
    Serial.print("] SSID: '");
    Serial.print(scannedSSID);
    Serial.print("' | RSSI: ");
    Serial.println(WiFi.RSSI(i));
    
    if (scannedSSID == ".hidden") {
      ssidToConnect = scannedSSID;
      foundHomeWiFi = true;
      Serial.print("Matched home WiFi: ");
      Serial.println(ssidToConnect);
      break;
    }
  }
  
  // Second pass: if home WiFi not found, look for iPhone hotspot
  if (!foundHomeWiFi) {
    for (int i = 0; i < numNetworks; i++) {
      String scannedSSID = WiFi.SSID(i);
      if (scannedSSID.indexOf("iPhone") >= 0) {
        ssidToConnect = scannedSSID;
        Serial.print("Home WiFi not found. Using iPhone hotspot: ");
        Serial.println(ssidToConnect);
        break;
      }
    }
  }
  
  if (ssidToConnect.length() == 0) {
    // Final fallback: use the configured SSID directly
    ssidToConnect = WIFI_SSID;
    Serial.print("No known networks found. Using configured SSID: ");
    Serial.println(ssidToConnect);
  }

  Serial.print("Connecting to: ");
  Serial.println(ssidToConnect);
  
  // Use appropriate password based on which network we're connecting to
  String passwordToUse = WIFI_PASSWORD;
  if (foundHomeWiFi) {
    Serial.println("Using HOME_WIFI_PASSWORD");
    passwordToUse = HOME_WIFI_PASSWORD;
  } else {
    Serial.println("Using WIFI_PASSWORD (iPhone hotspot)");
  }
  
  WiFi.begin(ssidToConnect.c_str(), passwordToUse.c_str());
  Serial.print("Attempting connection");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // WiFi connected: visual feedback
    delay(500);  // Brief pause after connection
    flashRunningLights(2, 200, 200);
  } else {
    Serial.println();
    Serial.print("WiFi connection failed. Status: ");
    Serial.println(WiFi.status());
    Serial.println("Server will start anyway. Will retry WiFi in loop.");
  }
}

// ==================== STARTUP VISUAL FEEDBACK ====================
// Flash the running lights to provide visual feedback during startup
void flashRunningLights(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_RUNNING_PIN, HIGH);
    digitalWrite(RUNNING_OUT_PIN, HIGH);
    delay(onMs);
    digitalWrite(LED_RUNNING_PIN, LOW);
    digitalWrite(RUNNING_OUT_PIN, LOW);
    if (i < times - 1) {  // Don't delay after the last flash
      delay(offMs);
    }
  }
}

// ==================== WATER SENSOR DEBOUNCING ====================
// Updates the debounced water state based on raw sensor readings
// Water must stay in same state for WATER_DEBOUNCE_TIME to register state change
void updateWaterSensorDebounce() {
  bool rawState = (digitalRead(WATER_SENSOR_PIN) == HIGH);  // true = dry, false = wet
  unsigned long currentTime = millis();
  
  // Check if raw state has changed
  if (rawState != waterLastRawState) {
    // Raw state changed, reset the timer
    waterLastRawState = rawState;
    waterStateChangeTime = currentTime;
  } else {
    // Raw state is the same, check if debounce time has elapsed
    unsigned long timeSinceChange = currentTime - waterStateChangeTime;
    
    if (timeSinceChange >= WATER_DEBOUNCE_TIME) {
      // Debounce time elapsed, update the debounced state
      // rawState = true means DRY, so waterDebouncedState = false (secure)
      // rawState = false means WET, so waterDebouncedState = true (breached)
      waterDebouncedState = !rawState;
    }
  }
}

// ==================== RMT THROTTLE CAPTURE (NON-BLOCKING PWM) ====================
// Initialize RMT for throttle PWM capture
void setupRMT() {
  rmt_config_t rmt_rx_config = RMT_DEFAULT_CONFIG_RX((gpio_num_t)THROTTLE_PWM_PIN, RMT_RX_CHANNEL);
  rmt_rx_config.clk_div = RMT_CLK_DIV;
  rmt_config(&rmt_rx_config);
  rmt_driver_install(RMT_RX_CHANNEL, 1000, 0);
  rmt_rx_start(RMT_RX_CHANNEL, true);
  
  Serial.println("RMT PWM capture initialized on GPIO18");
  Serial.println("  Clock: 1 MHz (1 tick = 1 us)");
  Serial.println("  Expected range: 1000-2000 us");
}

// Update throttle value from RMT (call periodically from loop)
void updateThrottleRMT() {
  size_t rx_size = 0;
  rmt_item32_t* items = NULL;
  RingbufHandle_t rb = NULL;
  
  // Get ringbuffer handle
  rmt_get_ringbuf_handle(RMT_RX_CHANNEL, &rb);
  
  // Non-blocking receive with immediate timeout
  items = (rmt_item32_t*) xRingbufferReceive(rb, &rx_size, 0);
  
  if (items) {
    // Parse RMT items to extract pulse width
    uint32_t high_ticks = 0;
    for (size_t i = 0; i < rx_size / sizeof(rmt_item32_t); i++) {
      if (items[i].level0 == 1) {  // HIGH portion of PWM
        high_ticks += items[i].duration0;
      }
      if (items[i].level1 == 1) {
        high_ticks += items[i].duration1;
      }
    }
    
    // Convert ticks to microseconds (1 tick = 1us at 1MHz clock)
    uint32_t pulse_us = high_ticks;
    
    // Validate range (typical RC PWM: 1000-2000us)
    if (pulse_us >= 800 && pulse_us <= 2200) {
      throttle_pulse_us = pulse_us;
      last_throttle_update = millis();
    }
    
    // Return buffer to ringbuffer
    vRingbufferReturnItem(rb, (void*) items);
  }
  
  // Timeout handling: revert to safe idle if no signal
  if (millis() - last_throttle_update > 500) {
    throttle_pulse_us = 1500;  // neutral position
  }
}

// ==================== I2S AUDIO OUTPUT ====================
// Initialize I2S driver for MAX98357A amplifier
void setupI2S() {
  Serial.println("Initializing I2S for MAX98357A...");
  
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = I2S_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,  // mono
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
  
  // Install and configure I2S driver
  esp_err_t err = i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("ERROR: I2S driver install failed: %d\n", err);
    return;
  }
  
  err = i2s_set_pin(I2S_NUM, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("ERROR: I2S pin config failed: %d\n", err);
    return;
  }
  
  i2s_zero_dma_buffer(I2S_NUM);
  
  Serial.println("  ✓ I2S driver installed");
  Serial.printf("  Sample rate: %d Hz\n", I2S_SAMPLE_RATE);
  Serial.printf("  Pins: BCLK=%d, LRC=%d, DIN=%d\n", I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DIN_PIN);
}

// ==================== AUDIO ENGINE TASK ====================
// FreeRTOS task for continuous audio rendering
void audioTaskFunction(void* param) {
  int16_t audio_buffer[I2S_BUFFER_SIZE];
  size_t bytes_written;
  
  Serial.println("Audio engine task started on Core 1");
  
  while (true) {
    // Read cached throttle from RMT
    float throttle_norm = (throttle_pulse_us - 1000.0f) / 1000.0f;
    throttle_norm = constrain(throttle_norm, 0.0f, 1.0f);
    
    // Update engine state (applies smoothing, rev detection, etc.)
    audioEngine_updateThrottle(throttle_norm);
    
    // Render PCM samples into buffer
    audioEngine_renderSamples(audio_buffer, I2S_BUFFER_SIZE);
    
    // Write to I2S (blocks until DMA buffer has space)
    i2s_write(I2S_NUM, audio_buffer, I2S_BUFFER_SIZE * 2, &bytes_written, portMAX_DELAY);
  }
}

// Create and start audio task
void setupAudioTask() {
  xTaskCreatePinnedToCore(
    audioTaskFunction,
    "AudioEngine",
    4096,          // stack size (4KB)
    NULL,          // no parameters
    5,             // priority (higher than main loop)
    NULL,          // no task handle needed
    1              // core 1 (core 0 runs WiFi)
  );
  
  Serial.println("Audio engine task created on Core 1 (priority 5)");
}

// ==================== DFPLAYER AUDIO FUNCTIONS ====================
// Play DFPlayer Pro track using DF1201S library
void playDFPlayerTrack(int trackNumber, int volumePercent) {
  if (!dfPlayerAvailable) return;
  
  // Set volume (0-30 for DF1201S)
  int volume = map(volumePercent, 0, 100, 0, 30);
  DF1201S.setVol(volume);
  delay(50);
  
  // Play file by number (based on write order to module)
  DF1201S.playFileNum(trackNumber);
  
  Serial.print("DFPlayer Pro: Track ");
  Serial.print(trackNumber);
  Serial.print(" @ ");
  Serial.print(volumePercent);
  Serial.println("%");
}

// Play Edmund Fitzgerald easter egg by file path (avoids index dependency)
void playEdmundEasterEgg() {
  if (!dfPlayerAvailable) return;
  
  // Set volume for easter egg (85%)
  int volume = map(85, 0, 100, 0, 30);  // 85% = 25.5/30
  DF1201S.setVol(volume);
  delay(100);
  
  // Force SINGLE play mode
  DF1201S.setPlayMode(DF1201S.SINGLE);
  delay(50);
  
  // Play by file path using raw AT command (bypasses FileNumber index)
  // AT+PLAYFILE requires CRLF termination
  Serial.println("Playing Edmund Fitzgerald easter egg...");
  Serial2.print("AT+PLAYFILE=/SFX/EDMUND.MP3\r\n");
  Serial2.flush();
  delay(100);
}

// ==================== CORS HELPER ====================
void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ==================== RC PWM READER ====================
// Reads PWM pulse width in microseconds (typical RC: 1000-2000µs, 1500µs = center)
unsigned int readPWM(int pin) {
  unsigned long pulseWidth = pulseIn(pin, HIGH, 25000); // 25ms timeout (50Hz = 20ms period)
  if (pulseWidth == 0) {
    return 0; // No signal or timeout
  }
  return (unsigned int)pulseWidth;
}

// ==================== HTTP HANDLERS ====================
void handleStatus() {
  addCORSHeaders();
  unsigned long uptimeSec = (millis() - startTime) / 1000;
  String json = "{";
  json += "\"firmware_version\":\"" + String(FIRMWARE_VERSION) + "\",";
  json += "\"build_id\":\"" + String(BUILD_ID) + "\",";
  json += "\"connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  json += "\"ip_address\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"uptime_seconds\":" + String(uptimeSec) + ",";
  json += "\"running_led\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"flood_led\":" + String(ledFloodState ? "true" : "false") + ",";
  json += "\"dfplayer_available\":" + String(dfPlayerAvailable ? "true" : "false");
  json += "}";
  server.send(200, "application/json", json);
}

void handleTelemetry() {
  addCORSHeaders();
  unsigned long uptimeSec = (millis() - startTime) / 1000;
  int rssi = WiFi.RSSI();
  
  // Battery voltage reading (GPIO 34 ADC)
  // In ESP32 Core 3.x, analogReadMilliVolts is the safe, modern way to read ADC
  uint32_t mv = analogReadMilliVolts(BATTERY_ADC_PIN);
  float batteryPinVoltage = mv / 1000.0;
  
  // Calibration: 3.3V input was reading 1.16V, so multiply by 3.3/1.16 = 2.84
  float batteryVoltage = batteryPinVoltage * 2.84;
  int adcValue = (int)((batteryPinVoltage / 3.3) * 4095); // Reconstruct raw value for JSON
  
  // Water intrusion sensor (debounced digital read with pullup)
  // Debounced state: true = water breached hull, false = hull secure
  // Takes 10 seconds of consistent state to register a change
  bool waterDetected = waterDebouncedState;
  int waterRaw = digitalRead(WATER_SENSOR_PIN); // 0 = WET, 1 = DRY (pullup) - raw instantaneous value

  // RC receiver PWM readings (pulse width in microseconds)
  // Typical range: 1000-2000µs, 1500µs = center/neutral
  // Throttle is captured via RMT (non-blocking), servo still uses blocking pulseIn
  unsigned int throttlePWM = throttle_pulse_us;  // From RMT cache
  unsigned int servoPWM = readPWM(SERVO_PWM_PIN);  // Servo still uses old method

  // ESP32 diagnostics
  uint32_t freeHeap = ESP.getFreeHeap();
  // float internalTemp = temperatureRead();  // Disabled: conflicts with analogRead() in ESP-IDF 5.x

  String json = "{";
  json += "\"timestamp\":\"" + String(millis()) + "\",";
  json += "\"battery_voltage\":\"" + String(batteryVoltage, 2) + "V\",";
  json += "\"battery_pin_voltage\":\"" + String(batteryPinVoltage, 2) + "V\",";
  json += "\"battery_adc_raw\":" + String(adcValue) + ",";
  json += "\"signal_strength\":\"" + String(rssi) + "dBm\",";
  json += "\"uptime_seconds\":" + String(uptimeSec) + ",";
  json += "\"free_heap\":" + String(freeHeap) + ",";
  json += "\"running_mode_state\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"flood_mode_state\":" + String(ledFloodState ? "true" : "false") + ",";
  json += "\"dfplayer_available\":" + String(dfPlayerAvailable ? "true" : "false") + ",";
  json += "\"water_intrusion\":" + String(waterDetected ? "true" : "false") + ",";
  json += "\"water_sensor_raw\":" + String(waterRaw) + ",";
  json += "\"throttle_pwm\":" + String(throttlePWM) + ",";
  json += "\"servo_pwm\":" + String(servoPWM) + ",";
  json += "\"connection_status\":\"" + String(WiFi.status() == WL_CONNECTED ? "online" : "offline") + "\",";
  json += "\"ip_address\":\"" + WiFi.localIP().toString() + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

void handleEngineDebug() {
  addCORSHeaders();
  
  // Get raw and normalized throttle values
  float throttle_norm = (throttle_pulse_us - 1000.0f) / 1000.0f;
  throttle_norm = constrain(throttle_norm, 0.0f, 1.0f);
  
  // Get current engine state
  float engine_rate = audioEngine_getRate();
  float engine_gain = audioEngine_getGain();
  float smoothed = audioEngine_getSmoothedThrottle();
  bool rev_active = audioEngine_isRevActive();
  
  String json = "{";
  json += "\"throttle_raw_us\":" + String(throttle_pulse_us) + ",";
  json += "\"throttle_normalized\":" + String(throttle_norm, 3) + ",";
  json += "\"throttle_smoothed\":" + String(smoothed, 3) + ",";
  json += "\"engine_rate\":" + String(engine_rate, 3) + ",";
  json += "\"engine_gain\":" + String(engine_gain, 3) + ",";
  json += "\"rev_active\":" + String(rev_active ? "true" : "false") + ",";
  json += "\"last_update_ms\":" + String(last_throttle_update);
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleLed() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  String body = server.arg("plain");
  
  // Simple parsing (avoid external JSON library for now)
  bool modeRunning = body.indexOf("\"running\"") >= 0;
  bool modeFlood = body.indexOf("\"flood\"") >= 0;
  bool stateOn = body.indexOf("\"on\"") >= 0;

  if (modeRunning) {
    ledRunningState = stateOn;
    // Keep onboard LED for quick visual testing AND drive external MOSFET gate
    digitalWrite(LED_RUNNING_PIN, ledRunningState ? HIGH : LOW);
    digitalWrite(RUNNING_OUT_PIN, ledRunningState ? HIGH : LOW);
  }
  
  if (modeFlood) {
    ledFloodState = stateOn;
    // Drive indicator LED and flood MOSFET gate for flood circuit power
    digitalWrite(LED_FLOOD_PIN, ledFloodState ? HIGH : LOW);
    digitalWrite(FLOOD_OUT_PIN, ledFloodState ? HIGH : LOW);
  }

  String json = "{";
  json += "\"running_led\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"flood_led\":" + String(ledFloodState ? "true" : "false");
  json += "}";
  server.send(200, "application/json", json);
}

void handleHorn() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  // DFPlayer ONLY - no PWM fallback for audio files
  if (!dfPlayerAvailable) {
    server.send(503, "application/json", "{\"error\":\"DFPlayer not available\"}");
    return;
  }

  // Track 4: Horn sound
  playDFPlayerTrack(4, 100);  // 100% volume
  server.send(200, "application/json", "{\"horn_active\":true}");
}

void handleSOS() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  // DFPlayer ONLY - no PWM fallback (SOS is critical, should have audio file)
  if (!dfPlayerAvailable) {
    server.send(503, "application/json", "{\"error\":\"DFPlayer not available\"}");
    return;
  }

  // Force SINGLE play mode (play once and stop - don't continue to next tracks)
  DF1201S.setPlayMode(DF1201S.SINGLE);
  delay(100);

  // Track 5: SOS morse code audio (9 seconds)
  playDFPlayerTrack(5, 50);  // 50% volume
  Serial.println("SOS (DFPlayer track 5)");

  server.send(200, "application/json", "{\"sos_active\":true}");
}

void handleEasterEgg() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  // DFPlayer required for easter egg
  if (!dfPlayerAvailable) {
    server.send(503, "application/json", "{\"error\":\"DFPlayer not available\"}");
    return;
  }

  // Play Edmund Fitzgerald song by file path
  playEdmundEasterEgg();
  
  server.send(200, "application/json", "{\"easter_egg\":true,\"message\":\"The legend lives on...\"}");
}

void handleRadio() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing request body\"}");
    return;
  }

  // DFPlayer ONLY - no PWM fallback for audio files
  if (!dfPlayerAvailable) {
    server.send(503, "application/json", "{\"error\":\"DFPlayer not available\"}");
    return;
  }

  String body = server.arg("plain");
  int radioId = 1;
  
  int idIndex = body.indexOf("\"radio_id\"");
  if (idIndex >= 0) {
    int colonIndex = body.indexOf(":", idIndex);
    if (colonIndex >= 0) {
      String idStr = body.substring(colonIndex + 1);
      idStr.trim();
      radioId = idStr.toInt();
    }
  }

  if (radioId < 1 || radioId > 3) {
    server.send(400, "application/json", "{\"error\":\"Invalid radio_id (must be 1-3)\"}");
    return;
  }

  // DFPlayer tracks: 1=radio1, 2=radio2, 3=radio3
  playDFPlayerTrack(radioId, 47);  // 47% volume

  String json = "{\"radio_active\":true,\"radio_id\":" + String(radioId) + "}";
  server.send(200, "application/json", json);
}

void handleOptions() {
  addCORSHeaders();
  server.send(200);
}

void handleNotFound() {
  addCORSHeaders();
  server.send(404, "application/json", "{\"error\":\"not found\"}");
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("=== Boat Telemetry Starting ===");

  // Init LED pins
  pinMode(LED_RUNNING_PIN, OUTPUT);
  pinMode(LED_FLOOD_PIN, OUTPUT);
  pinMode(RUNNING_OUT_PIN, OUTPUT);
  pinMode(FLOOD_OUT_PIN, OUTPUT);
  digitalWrite(LED_RUNNING_PIN, LOW);
  digitalWrite(LED_FLOOD_PIN, LOW);
  digitalWrite(RUNNING_OUT_PIN, LOW);
  digitalWrite(FLOOD_OUT_PIN, LOW);
  
  // Init RMT for non-blocking throttle PWM capture
  Serial.println();
  Serial.println("========================================");
  Serial.println("RMT PWM Capture Initialization");
  Serial.println("========================================");
  setupRMT();
  delay(100);  // Let RMT stabilize
  Serial.println("========================================");
  
  // Init I2S audio output for MAX98357A
  Serial.println();
  Serial.println("========================================");
  Serial.println("I2S Audio System Initialization");
  Serial.println("========================================");
  setupI2S();
  Serial.println("========================================");
  
  // Init audio engine and start FreeRTOS task
  Serial.println();
  Serial.println("========================================");
  Serial.println("Engine Audio System Initialization");
  Serial.println("========================================");
  audioEngine_init();
  setupAudioTask();
  Serial.println("========================================");
  
  // Init DFPlayer Pro (DF1201S chip, 115200 baud, AT commands)
  Serial.println();
  Serial.println("========================================");
  Serial.println("DFPlayer Pro Initialization");
  Serial.println("========================================");
  Serial.print("RX: GPIO");
  Serial.print(DFPLAYER_RX);
  Serial.print(" | TX: GPIO");
  Serial.println(DFPLAYER_TX);
  
  // Initialize Serial2 at 115200 baud for DFPlayer Pro
  Serial.println("Starting Serial2 at 115200 baud...");
  Serial2.begin(115200, SERIAL_8N1, DFPLAYER_RX, DFPLAYER_TX);
  Serial.println("Waiting 3 seconds for DFPlayer Pro to stabilize...");
  delay(3000);  // DFPlayer Pro needs time to boot and stabilize
  
  // Clear any startup garbage from buffer
  while(Serial2.available()) {
    Serial2.read();
  }
  
  Serial.println("Attempting DF1201S.begin()...");
  
  // Initialize DF1201S library
  if (!DF1201S.begin(Serial2)) {
    Serial.println("✗ DFPlayer Pro init failed - using PWM fallback");
    Serial.println("  Check: Power, wiring, or try power-cycling ESP32");
    dfPlayerAvailable = false;
  } else {
    Serial.println("✓ DFPlayer Pro connected!");
    
    // Switch to MUSIC mode
    Serial.println("Switching to MUSIC mode...");
    DF1201S.switchFunction(DF1201S.MUSIC);
    delay(2000);  // Wait for prompt tone
    
    // Set play mode to single (play once)
    Serial.println("Setting play mode to SINGLE...");
    DF1201S.setPlayMode(DF1201S.SINGLE);
    delay(200);
    
    // Set initial volume (0-30)
    Serial.println("Setting volume to 20/30...");
    DF1201S.setVol(20);
  delay(200);
    
    dfPlayerAvailable = true;
    Serial.println("✓ DFPlayer Pro ready for playback!");
  }
  Serial.println("========================================");
  
  // Init water sensor pin (digital with internal pullup)
  pinMode(WATER_SENSOR_PIN, INPUT_PULLUP);
  // Initialize debouncing state (assume dry/secure at startup)
  waterLastRawState = (digitalRead(WATER_SENSOR_PIN) == HIGH);  // true = dry
  waterDebouncedState = false;  // Start as secure
  waterStateChangeTime = millis();
  
  // Init battery ADC pin (Core 3.x doesn't require pinMode for ANALOG, but use INPUT to be safe)
  pinMode(BATTERY_ADC_PIN, INPUT);
  
  // Init RC receiver PWM input pins (no pullup - receiver drives the signal)
  pinMode(THROTTLE_PWM_PIN, INPUT);
  pinMode(SERVO_PWM_PIN, INPUT);

  startTime = millis();
  
  // Startup feedback: visual flash = "Boot successful"
  Serial.println("Boot complete - flashing running lights");
  flashRunningLights(1, 1000, 0);
  delay(500);  // Brief pause before WiFi connection

  // Connect WiFi
  connectWiFi();

  // Setup HTTP routes
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/telemetry", HTTP_GET, handleTelemetry);
  server.on("/led", HTTP_POST, handleLed);
  server.on("/horn", HTTP_POST, handleHorn);
  server.on("/sos", HTTP_POST, handleSOS);
  server.on("/radio", HTTP_POST, handleRadio);
  server.on("/easter-egg", HTTP_POST, handleEasterEgg);
  server.on("/engine-debug", HTTP_GET, handleEngineDebug);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/telemetry", HTTP_OPTIONS, handleOptions);
  server.on("/led", HTTP_OPTIONS, handleOptions);
  server.on("/horn", HTTP_OPTIONS, handleOptions);
  server.on("/sos", HTTP_OPTIONS, handleOptions);
  server.on("/radio", HTTP_OPTIONS, handleOptions);
  server.on("/easter-egg", HTTP_OPTIONS, handleOptions);
  server.on("/engine-debug", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("HTTP server started on port 80.");
}

// ==================== LOOP ====================
unsigned long lastWiFiCheck = 0;

void loop() {
  // Always handle HTTP requests (whether WiFi is connected or not)
  server.handleClient();
  
  // Update throttle from RMT (non-blocking)
  updateThrottleRMT();
  
  // Update water sensor debouncing
  updateWaterSensorDebounce();

  // Retry WiFi every 30 seconds if disconnected
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck > 30000) {
    lastWiFiCheck = millis();
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.disconnect();
    delay(100);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  // Keep alive marker every 5 seconds
  static unsigned long lastKeepAlive = 0;
  if (millis() - lastKeepAlive > 5000) {
    lastKeepAlive = millis();
    Serial.print(".");
  }
}
