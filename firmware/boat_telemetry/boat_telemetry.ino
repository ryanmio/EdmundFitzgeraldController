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
#define FIRMWARE_VERSION   "1.0.0"
#define BUILD_ID           "20260109"             // YYYYMMDD format

// ==================== MORSE CODE DEFINITIONS ====================
// Buzzer gets constant 5V power. GPIO17 drives I/O pin directly for tones.
#define MORSE_BUZZER_PIN   17              // Buzzer module I/O pin (direct PWM, no MOSFET)
#define MORSE_FREQUENCY    800             // Hz - classic WW2 radio telegraph tone
#define MORSE_DIT_MS       150             // Dit (dot) length in milliseconds
#define MORSE_DAH_MS       (MORSE_DIT_MS * 3)    // Dah (dash) = 3x dit
#define MORSE_SYMBOL_GAP   MORSE_DIT_MS          // Gap between dits/dahs
#define MORSE_LETTER_GAP   (MORSE_DIT_MS * 3)    // Gap between letters
#define MORSE_REPEAT_DELAY 2000                  // Pause between SOS repeats

// ==================== GLOBALS ====================
WebServer server(80);
unsigned long startTime;
bool ledRunningState = false;
bool ledFloodState = false;

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
    ledcWriteTone(MORSE_BUZZER_PIN, MORSE_FREQUENCY);
    delay(MORSE_DIT_MS);
    ledcWriteTone(MORSE_BUZZER_PIN, 0);
    delay(MORSE_SYMBOL_GAP);
  }
  ledcWriteTone(MORSE_BUZZER_PIN, 0); // Ensure silent
}

// Play WiFi connected tone (blocking - used during setup only)
void playWiFiConnectedTone() {
  // dit-dah-dit pattern
  ledcWriteTone(MORSE_BUZZER_PIN, MORSE_FREQUENCY);
  delay(MORSE_DIT_MS);
  ledcWriteTone(MORSE_BUZZER_PIN, 0);
  delay(MORSE_SYMBOL_GAP);
  
  ledcWriteTone(MORSE_BUZZER_PIN, MORSE_FREQUENCY);
  delay(MORSE_DAH_MS);
  ledcWriteTone(MORSE_BUZZER_PIN, 0);
  delay(MORSE_SYMBOL_GAP);
  
  ledcWriteTone(MORSE_BUZZER_PIN, MORSE_FREQUENCY);
  delay(MORSE_DIT_MS);
  ledcWriteTone(MORSE_BUZZER_PIN, 0);
  delay(500); // Pause at end
}

// Non-blocking Morse code state machine - call this repeatedly in loop()
void updateMorseCode() {
  if (!ledFloodState) {
    // Flood mode off - ensure buzzer is silent and reset
    if (morseStep != 0 || morseToneOn) {
      ledcWriteTone(MORSE_BUZZER_PIN, 0);
      morseStep = 0;
      morseToneOn = false;
    }
    return;
  }

  // Flood mode on: buzzer has constant power, just drive tones
  
  unsigned long currentTime = millis();
  
  if (morseToneOn) {
    // Tone is currently playing - check if it's time to turn it off
    if (currentTime - morseLastChange >= SOS_PATTERN[morseStep]) {
      ledcWriteTone(MORSE_BUZZER_PIN, 0); // Turn off tone
      morseToneOn = false;
      morseLastChange = currentTime;
    }
  } else {
    // Silence gap - check if it's time to start next tone
    if (currentTime - morseLastChange >= SOS_GAPS[morseStep]) {
      morseStep++;
      if (morseStep >= 9) {
        morseStep = 0; // Loop back to start of SOS
      }
      ledcWriteTone(MORSE_BUZZER_PIN, MORSE_FREQUENCY); // Start next tone
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
  json += "\"flood_led\":" + String(ledFloodState ? "true" : "false");
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
  json += "\"flood_mode_state\":" + String(ledFloodState ? "true" : "false") + ",";
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
    // Buzzer has constant power - just control tones via MORSE_BUZZER_PIN
    digitalWrite(LED_FLOOD_PIN, ledFloodState ? HIGH : LOW);
    
    // If turning off, stop any active Morse tone
    if (!stateOn) {
      ledcWriteTone(MORSE_BUZZER_PIN, 0);
      morseStep = 0;
      morseToneOn = false;
      morseLastChange = 0;
    } else {
      // Start SOS immediately (don't wait for initial gap)
      morseStep = 0;
      morseToneOn = true;
      morseLastChange = millis();
      ledcWriteTone(MORSE_BUZZER_PIN, MORSE_FREQUENCY);
    }
  }

  String json = "{";
  json += "\"running_led\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"flood_led\":" + String(ledFloodState ? "true" : "false");
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
  
  // Init Morse code buzzer (PWM tone on GPIO17, buzzer has constant 5V power)
  pinMode(MORSE_BUZZER_PIN, OUTPUT);
  ledcAttach(MORSE_BUZZER_PIN, MORSE_FREQUENCY, 8); // 8-bit resolution
  ledcWriteTone(MORSE_BUZZER_PIN, 0); // Start silent
  
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
  server.on("/stream", HTTP_GET, handleStream);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/telemetry", HTTP_OPTIONS, handleOptions);
  server.on("/led", HTTP_OPTIONS, handleOptions);
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

  // Update Morse code SOS (non-blocking)
  updateMorseCode();

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
