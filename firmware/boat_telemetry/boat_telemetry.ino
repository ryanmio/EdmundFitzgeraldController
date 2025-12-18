/*
 * boat_telemetry.ino
 * Simplified pre-camera firmware for ESP32 dev board.
 * Endpoints: /status, /telemetry, /led, /stream (placeholder)
 */

#include <WiFi.h>
#include <WebServer.h>
#include "secrets.h"

// ==================== PIN DEFINITIONS ====================
#define LED_RUNNING_PIN  2   // Built-in LED on most dev boards
#define LED_FLOOD_PIN    4   // External LED (optional)

// ==================== GLOBALS ====================
WebServer server(80);
unsigned long startTime;
bool ledRunningState = false;
bool ledFloodState = false;

// ==================== WIFI CONNECT (SIMPLE) ====================
void connectWiFi() {
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

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

// ==================== HTTP HANDLERS ====================
void handleStatus() {
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
  unsigned long uptimeSec = (millis() - startTime) / 1000;
  int rssi = WiFi.RSSI();
  
  // Placeholder battery voltage (will add ADC later)
  float batteryVoltage = 0.0;

  String json = "{";
  json += "\"timestamp\":\"" + String(millis()) + "\",";
  json += "\"battery_voltage\":\"" + String(batteryVoltage, 1) + "V\",";
  json += "\"signal_strength\":\"" + String(rssi) + "dBm\",";
  json += "\"uptime_seconds\":" + String(uptimeSec) + ",";
  json += "\"running_mode_state\":" + String(ledRunningState ? "true" : "false") + ",";
  json += "\"flood_mode_state\":" + String(ledFloodState ? "true" : "false") + ",";
  json += "\"connection_status\":\"" + String(WiFi.status() == WL_CONNECTED ? "online" : "offline") + "\",";
  json += "\"ip_address\":\"" + WiFi.localIP().toString() + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

void handleLed() {
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
  // Placeholder until camera hardware arrives
  server.send(200, "text/plain", "Camera not connected. Stream will be available after ESP32-CAM integration.");
}

void handleNotFound() {
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

  startTime = millis();

  // Connect WiFi
  connectWiFi();

  // Setup HTTP routes
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/telemetry", HTTP_GET, handleTelemetry);
  server.on("/led", HTTP_POST, handleLed);
  server.on("/stream", HTTP_GET, handleStream);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("HTTP server started on port 80.");
}

// ==================== LOOP ====================
unsigned long lastWiFiCheck = 0;

void loop() {
  server.handleClient();

  // Retry WiFi every 30 seconds if disconnected
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiCheck > 30000) {
    lastWiFiCheck = millis();
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.disconnect();
    delay(1000);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}
