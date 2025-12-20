/*
 * boat_telemetry.ino
 * Simplified pre-camera firmware for ESP32 dev board.
 * Endpoints: /status, /telemetry, /led, /stream (placeholder)
 */

#include <WiFi.h>
#include <WebServer.h>
#include "secrets.h"

// ==================== PIN DEFINITIONS ====================
#define LED_RUNNING_PIN    2   // Built-in LED on most dev boards
#define LED_FLOOD_PIN      4   // External LED (optional)
#define BATTERY_ADC_PIN   34   // Battery voltage sense (ADC)
#define WATER_SENSOR_PIN  32   // Water intrusion sensor (digital input with pullup) - GPIO32 has internal pullup, GPIO34/35/36/39 do NOT

// ==================== GLOBALS ====================
WebServer server(80);
unsigned long startTime;
bool ledRunningState = false;
bool ledFloodState = false;

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
  } else {
    Serial.println();
    Serial.print("WiFi connection failed. Status: ");
    Serial.println(WiFi.status());
    Serial.println("Server will start anyway. Will retry WiFi in loop.");
  }
}

// ==================== CORS HELPER ====================
void addCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ==================== HTTP HANDLERS ====================
void handleStatus() {
  addCORSHeaders();
  unsigned long uptimeSec = (millis() - startTime) / 1000;
  String json = "{";
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
  // Voltage divider: 100kΩ + 47kΩ (divides by 3.14)
  // ADC: 0-4095 maps to 0-3.3V
  // So actual voltage = (ADC / 4095) * 3.3 * 3.14
  int adcValue = analogRead(BATTERY_ADC_PIN);
  float batteryPinVoltage = (adcValue / 4095.0) * 3.3;
  float batteryVoltage = batteryPinVoltage * 3.14;
  
  // Water intrusion sensor (digital read with pullup)
  // LOW = water detected (probe gap bridged by water)
  // HIGH = dry (pullup resistance)
  bool waterDetected = (digitalRead(WATER_SENSOR_PIN) == LOW);
  int waterRaw = digitalRead(WATER_SENSOR_PIN); // 0 = WET, 1 = DRY (pullup)

  String json = "{";
  json += "\"timestamp\":\"" + String(millis()) + "\",";
  json += "\"battery_voltage\":\"" + String(batteryVoltage, 2) + "V\",";
  json += "\"battery_pin_voltage\":\"" + String(batteryPinVoltage, 2) + "V\",";
  json += "\"battery_adc_raw\":" + String(adcValue) + ",";
  json += "\"signal_strength\":\"" + String(rssi) + "dBm\",";
  json += "\"uptime_seconds\":" + String(uptimeSec) + ",";
  json += "\"running_mode_state\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"flood_mode_state\":" + String(ledFloodState ? "true" : "false") + ",";
  json += "\"water_intrusion\":" + String(waterDetected ? "true" : "false") + ",";
  json += "\"water_sensor_raw\":" + String(waterRaw) + ",";
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
    digitalWrite(LED_RUNNING_PIN, ledRunningState ? HIGH : LOW);
  }
  if (modeFlood) {
    ledFloodState = stateOn;
    digitalWrite(LED_FLOOD_PIN, ledFloodState ? HIGH : LOW);
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
  digitalWrite(LED_RUNNING_PIN, LOW);
  digitalWrite(LED_FLOOD_PIN, LOW);
  
  // Init water sensor pin (digital with internal pullup)
  pinMode(WATER_SENSOR_PIN, INPUT_PULLUP);
  
  // Init battery ADC pin
  pinMode(BATTERY_ADC_PIN, INPUT);

  startTime = millis();

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
