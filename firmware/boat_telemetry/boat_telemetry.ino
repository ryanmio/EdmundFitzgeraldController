/*
 * boat_telemetry.ino
 * Simplified pre-camera firmware for ESP32 dev board.
 * Endpoints: /status, /telemetry, /led, /stream (placeholder)
 */

#include <WiFi.h>
#include <WebServer.h>
#include "secrets.h"

// ==================== PIN DEFINITIONS ====================
#define LED_RUNNING_PIN    2   // Built-in LED on most dev boards (keep for testing)
#define LED_FLOOD_PIN      4   // Legacy external LED pin (optional spare)
#define RUNNING_OUT_PIN   16   // External Running lights control (MOSFET gate)
#define BATTERY_ADC_PIN   34   // Battery voltage sense (ADC)
#define WATER_SENSOR_PIN  32   // Water intrusion sensor (digital input with pullup) - GPIO32 has internal pullup, GPIO34/35/36/39 do NOT
#define THROTTLE_PWM_PIN  18   // RC receiver throttle channel (PWM input)
#define SERVO_PWM_PIN     19   // RC receiver servo/rudder channel (PWM input)

// ==================== BUILD IDENTIFICATION ====================
#define FIRMWARE_VERSION   "1.2.0"
#define BUILD_ID           "20260110"             // YYYYMMDD format

// ==================== AUDIO OUTPUT DEFINITIONS ====================
// Audio through PAM8403 amplifier + speaker (or compatible with piezo buzzer module)
// GPIO17 outputs PWM tone → PAM8403 INL → Speaker for loud sound effects
#define AUDIO_OUT_PIN      17              // PWM audio output (to amp or buzzer)
#define MORSE_FREQUENCY    800             // Hz - classic WW2 radio telegraph tone
#define HORN_FREQUENCY     200             // Hz - boat horn tone (future feature)
#define MORSE_DIT_MS       150             // Dit (dot) length in milliseconds
#define MORSE_DAH_MS       (MORSE_DIT_MS * 3)    // Dah (dash) = 3x dit
#define MORSE_SYMBOL_GAP   MORSE_DIT_MS          // Gap between dits/dahs
#define MORSE_LETTER_GAP   (MORSE_DIT_MS * 3)    // Gap between letters
#define MORSE_REPEAT_DELAY 2000                  // Pause between SOS repeats

// ==================== GLOBALS ====================
WebServer server(80);
unsigned long startTime;
bool ledRunningState = false;

// Audio sound effect state (horn and SOS are momentary, not toggle)
bool hornActive = false;
unsigned long hornStartTime = 0;
const unsigned long HORN_DURATION = 2000;  // 2 seconds per blast

bool sosActive = false;
unsigned long sosStartTime = 0;
int sosRoundsRemaining = 0;
const int SOS_ROUNDS_PER_TRIGGER = 3;  // Play 3 full SOS sequences per button press
const unsigned long SOS_ROUND_DURATION = 6000;  // ~6 seconds per SOS round (... --- ... + gaps)

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
    
    // WiFi connected: visual + audio feedback
    delay(500);  // Brief pause after connection
    flashRunningLights(2, 200, 200);
    
    // Play WiFi connected tone (buzzer has constant power)
    playWiFiConnectedTone();  // dit-dah-dit tone
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

// ==================== MORSE CODE FUNCTIONS (NON-BLOCKING) ====================
// SOS pattern: ... --- ... (9 symbols total)
const int SOS_PATTERN[] = {
  MORSE_DIT_MS, MORSE_DIT_MS, MORSE_DIT_MS,  // S
  MORSE_DAH_MS, MORSE_DAH_MS, MORSE_DAH_MS,  // O
  MORSE_DIT_MS, MORSE_DIT_MS, MORSE_DIT_MS   // S
};
const int SOS_GAPS[] = {
  MORSE_SYMBOL_GAP, MORSE_SYMBOL_GAP, MORSE_LETTER_GAP,  // After S
  MORSE_SYMBOL_GAP, MORSE_SYMBOL_GAP, MORSE_LETTER_GAP,  // After O
  MORSE_SYMBOL_GAP, MORSE_SYMBOL_GAP, MORSE_REPEAT_DELAY // After S
};

// Startup success tone: dit-dit-dit (... - three short beeps)
const int STARTUP_SUCCESS_PATTERN[] = {
  MORSE_DIT_MS, MORSE_DIT_MS, MORSE_DIT_MS
};
const int STARTUP_SUCCESS_GAPS[] = {
  MORSE_SYMBOL_GAP, MORSE_SYMBOL_GAP, 500  // Pause at end
};

// WiFi connected tone: dit-dah-dit (.-. - understood/acknowledged)
const int WIFI_CONNECTED_PATTERN[] = {
  MORSE_DIT_MS, MORSE_DAH_MS, MORSE_DIT_MS
};
const int WIFI_CONNECTED_GAPS[] = {
  MORSE_SYMBOL_GAP, MORSE_SYMBOL_GAP, 500  // Pause at end
};

int morseStep = 0;
bool morseToneOn = false;
unsigned long morseLastChange = 0;
const int* currentPattern = NULL;
const int* currentGaps = NULL;
int patternLength = 0;
bool isStartupTone = false;  // Flag to distinguish startup tones from SOS

// Play startup success tone (blocking - used during setup only)
void playStartupSuccessTone() {
  for (int i = 0; i < 3; i++) {
    ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY);
    delay(MORSE_DIT_MS);
    ledcWriteTone(AUDIO_OUT_PIN, 0);
    delay(MORSE_SYMBOL_GAP);
  }
  ledcWriteTone(AUDIO_OUT_PIN, 0); // Ensure silent
}

// Play WiFi connected tone (blocking - used during setup only)
void playWiFiConnectedTone() {
  // dit-dah-dit pattern
  ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY);
  delay(MORSE_DIT_MS);
  ledcWriteTone(AUDIO_OUT_PIN, 0);
  delay(MORSE_SYMBOL_GAP);
  
  ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY);
  delay(MORSE_DAH_MS);
  ledcWriteTone(AUDIO_OUT_PIN, 0);
  delay(MORSE_SYMBOL_GAP);
  
  ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY);
  delay(MORSE_DIT_MS);
  ledcWriteTone(AUDIO_OUT_PIN, 0);
  delay(500); // Pause at end
}

// Update horn sound effect (non-blocking, fixed duration)
void updateHorn() {
  if (!hornActive) return;
  
  unsigned long elapsed = millis() - hornStartTime;
  
  if (elapsed >= HORN_DURATION) {
    // Horn blast complete
    ledcWriteTone(AUDIO_OUT_PIN, 0);
    hornActive = false;
    Serial.println("Horn blast complete");
  }
  // Horn tone stays on for full duration (already started by trigger)
}

// Update SOS sound effect (non-blocking, plays fixed number of rounds)
void updateSOS() {
  if (!sosActive) return;
  
  unsigned long currentTime = millis();
  
  // Check if we've completed all rounds
  if (sosRoundsRemaining <= 0) {
    ledcWriteTone(AUDIO_OUT_PIN, 0);
    sosActive = false;
    morseStep = 0;
    morseToneOn = false;
    Serial.println("SOS sequence complete");
    return;
  }
  
  // Check if current round is complete
  unsigned long roundElapsed = currentTime - sosStartTime;
  if (roundElapsed >= SOS_ROUND_DURATION) {
    sosRoundsRemaining--;
    sosStartTime = currentTime;
    morseStep = 0;
    morseToneOn = true;
    morseLastChange = currentTime;
    ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY);
    Serial.print("SOS round, ");
    Serial.print(sosRoundsRemaining);
    Serial.println(" remaining");
    return;
  }
  
  // Play SOS pattern
  if (morseToneOn) {
    // Tone is currently playing - check if it's time to turn it off
    if (currentTime - morseLastChange >= SOS_PATTERN[morseStep]) {
      ledcWriteTone(AUDIO_OUT_PIN, 0); // Turn off tone
      morseToneOn = false;
      morseLastChange = currentTime;
    }
  } else {
    // Silence gap - check if it's time to start next tone
    if (currentTime - morseLastChange >= SOS_GAPS[morseStep]) {
      morseStep++;
      if (morseStep >= 9) {
        morseStep = 0; // Loop back to start of SOS within this round
      }
      ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY); // Start next tone
      morseToneOn = true;
      morseLastChange = currentTime;
    }
  }
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
  json += "\"horn_active\":" + String(hornActive ? "true" : "false") + ",";
  json += "\"sos_active\":" + String(sosActive ? "true" : "false");
  json += "}";
  server.send(200, "application/json", json);
}

void handleTelemetry() {
  addCORSHeaders();
  unsigned long uptimeSec = (millis() - startTime) / 1000;
  int rssi = WiFi.RSSI();
  
  // Battery voltage reading (GPIO 34 ADC)
  // Voltage divider: 100kΩ + 47kΩ
  // ADC: 0-4095 maps to 0-3.3V
  // Calibration: 3.3V input was reading 1.16V, so multiply by 3.3/1.16 = 2.84
  int adcValue = analogRead(BATTERY_ADC_PIN);
  float batteryPinVoltage = (adcValue / 4095.0) * 3.3;
  float batteryVoltage = batteryPinVoltage * 2.84;
  
  // Water intrusion sensor (debounced digital read with pullup)
  // Debounced state: true = water breached hull, false = hull secure
  // Takes 10 seconds of consistent state to register a change
  bool waterDetected = waterDebouncedState;
  int waterRaw = digitalRead(WATER_SENSOR_PIN); // 0 = WET, 1 = DRY (pullup) - raw instantaneous value

  // RC receiver PWM readings (pulse width in microseconds)
  // Typical range: 1000-2000µs, 1500µs = center/neutral
  unsigned int throttlePWM = readPWM(THROTTLE_PWM_PIN);
  unsigned int servoPWM = readPWM(SERVO_PWM_PIN);

  // ESP32 diagnostics
  uint32_t freeHeap = ESP.getFreeHeap();
  float internalTemp = temperatureRead();

  String json = "{";
  json += "\"timestamp\":\"" + String(millis()) + "\",";
  json += "\"battery_voltage\":\"" + String(batteryVoltage, 2) + "V\",";
  json += "\"battery_pin_voltage\":\"" + String(batteryPinVoltage, 2) + "V\",";
  json += "\"battery_adc_raw\":" + String(adcValue) + ",";
  json += "\"signal_strength\":\"" + String(rssi) + "dBm\",";
  json += "\"uptime_seconds\":" + String(uptimeSec) + ",";
  json += "\"free_heap\":" + String(freeHeap) + ",";
  json += "\"internal_temp_c\":" + String(internalTemp, 1) + ",";
  json += "\"running_mode_state\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"horn_active\":" + String(hornActive ? "true" : "false") + ",";
  json += "\"sos_active\":" + String(sosActive ? "true" : "false") + ",";
  json += "\"water_intrusion\":" + String(waterDetected ? "true" : "false") + ",";
  json += "\"water_sensor_raw\":" + String(waterRaw) + ",";
  json += "\"throttle_pwm\":" + String(throttlePWM) + ",";
  json += "\"servo_pwm\":" + String(servoPWM) + ",";
  json += "\"connection_status\":\"" + String(WiFi.status() == WL_CONNECTED ? "online" : "offline") + "\",";
  json += "\"ip_address\":\"" + WiFi.localIP().toString() + "\"";
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
  bool stateOn = body.indexOf("\"on\"") >= 0;

  if (modeRunning) {
    ledRunningState = stateOn;
    // Keep onboard LED for quick visual testing AND drive external MOSFET gate
    digitalWrite(LED_RUNNING_PIN, ledRunningState ? HIGH : LOW);
    digitalWrite(RUNNING_OUT_PIN, ledRunningState ? HIGH : LOW);
  }

  String json = "{";
  json += "\"running_led\":" + String(ledRunningState ? "true" : "false");
  json += "}";
  server.send(200, "application/json", json);
}

void handleHorn() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  // Trigger horn blast (2 seconds)
  hornActive = true;
  hornStartTime = millis();
  ledcWriteTone(AUDIO_OUT_PIN, HORN_FREQUENCY);
  Serial.println("Horn blast triggered");

  String json = "{";
  json += "\"horn_active\":true,";
  json += "\"duration_ms\":" + String(HORN_DURATION);
  json += "}";
  server.send(200, "application/json", json);
}

void handleSOS() {
  addCORSHeaders();
  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"POST required\"}");
    return;
  }

  // Trigger SOS sequence (3 rounds)
  sosActive = true;
  sosRoundsRemaining = SOS_ROUNDS_PER_TRIGGER;
  sosStartTime = millis();
  morseStep = 0;
  morseToneOn = true;
  morseLastChange = millis();
  ledcWriteTone(AUDIO_OUT_PIN, MORSE_FREQUENCY);
  Serial.print("SOS triggered: ");
  Serial.print(SOS_ROUNDS_PER_TRIGGER);
  Serial.println(" rounds");

  String json = "{";
  json += "\"sos_active\":true,";
  json += "\"rounds\":" + String(SOS_ROUNDS_PER_TRIGGER);
  json += "}";
  server.send(200, "application/json", json);
}

void handleStream() {
  addCORSHeaders();
  // Placeholder until camera hardware arrives
  server.send(200, "text/plain", "Camera not connected. Stream will be available after ESP32-CAM integration.");
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
  digitalWrite(LED_RUNNING_PIN, LOW);
  digitalWrite(LED_FLOOD_PIN, LOW);
  digitalWrite(RUNNING_OUT_PIN, LOW);
  
  // Init audio output (GPIO17 → PAM8403 amp or piezo buzzer module)
  pinMode(AUDIO_OUT_PIN, OUTPUT);
  ledcAttach(AUDIO_OUT_PIN, MORSE_FREQUENCY, 8); // 8-bit resolution PWM
  ledcWriteTone(AUDIO_OUT_PIN, 0); // Start silent
  
  // Init water sensor pin (digital with internal pullup)
  pinMode(WATER_SENSOR_PIN, INPUT_PULLUP);
  // Initialize debouncing state (assume dry/secure at startup)
  waterLastRawState = (digitalRead(WATER_SENSOR_PIN) == HIGH);  // true = dry
  waterDebouncedState = false;  // Start as secure
  waterStateChangeTime = millis();
  
  // Init battery ADC pin
  pinMode(BATTERY_ADC_PIN, INPUT);
  
  // Init RC receiver PWM input pins (no pullup - receiver drives the signal)
  pinMode(THROTTLE_PWM_PIN, INPUT);
  pinMode(SERVO_PWM_PIN, INPUT);

  startTime = millis();
  
  // Startup feedback: visual flash + audio tone = "Boot successful"
  Serial.println("Boot complete - flashing running lights and playing startup tone");
  flashRunningLights(1, 1000, 0);
  playStartupSuccessTone();  // dit-dit-dit tone (buzzer has constant power)
  delay(500);  // Brief pause before WiFi connection

  // Connect WiFi
  connectWiFi();

  // Setup HTTP routes
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/telemetry", HTTP_GET, handleTelemetry);
  server.on("/led", HTTP_POST, handleLed);
  server.on("/horn", HTTP_POST, handleHorn);
  server.on("/sos", HTTP_POST, handleSOS);
  server.on("/stream", HTTP_GET, handleStream);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/telemetry", HTTP_OPTIONS, handleOptions);
  server.on("/led", HTTP_OPTIONS, handleOptions);
  server.on("/horn", HTTP_OPTIONS, handleOptions);
  server.on("/sos", HTTP_OPTIONS, handleOptions);
  server.on("/stream", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("HTTP server started on port 80.");
}

// ==================== LOOP ====================
unsigned long lastWiFiCheck = 0;

void loop() {
  // Always handle HTTP requests (whether WiFi is connected or not)
  server.handleClient();
  
  // Update water sensor debouncing
  updateWaterSensorDebounce();

  // Update sound effects (non-blocking, momentary triggers)
  updateHorn();
  updateSOS();

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
