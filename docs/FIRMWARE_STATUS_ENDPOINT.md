# ESP32 Status Endpoint Configuration

## Overview

The device discovery feature in the Bridge Console relies on ESP32 devices responding to HTTP GET requests on the `/status` endpoint. This guide ensures your firmware is properly configured.

## Required Endpoint

Your ESP32 firmware must implement a `/status` endpoint that:

1. **Returns HTTP 200 OK** when the endpoint is reachable
2. **Returns valid JSON** with device information
3. **Responds quickly** (within 3 seconds)

## Minimum Status Response

Here's the minimal JSON response your `/status` endpoint should return:

```json
{
  "status": "ok",
  "device": "ESP32"
}
```

## Enhanced Status Response (Recommended)

For better device identification and type detection, include these fields:

### Telemetry Device

```json
{
  "status": "ok",
  "device": "ESP32",
  "type": "telemetry",
  "name": "Boat Telemetry Unit",
  "version": "1.0.0",
  "ip": "192.168.1.178",
  "uptime": 3600,
  "sensors": {
    "temperature": 25.5,
    "pressure": 1013.25,
    "battery": 85
  }
}
```

### Camera Device

```json
{
  "status": "ok",
  "device": "ESP32",
  "type": "camera",
  "name": "Boat Camera Unit",
  "version": "1.0.0",
  "ip": "192.168.1.200",
  "uptime": 3600,
  "camera": {
    "resolution": "1280x720",
    "fps": 30,
    "connected": true
  }
}
```

## Arduino Implementation Example

Here's example code for your Arduino sketch using the ArduinoJson library:

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

WebServer server(80);

// Handle /status endpoint
void handleStatus() {
  JsonDocument doc;
  
  doc["status"] = "ok";
  doc["device"] = "ESP32";
  doc["type"] = "telemetry"; // or "camera"
  doc["name"] = "Boat Telemetry Unit";
  doc["version"] = "1.0.0";
  doc["ip"] = WiFi.localIP().toString();
  doc["uptime"] = millis() / 1000;
  
  // Add sensor data if available
  JsonObject sensors = doc["sensors"].to<JsonObject>();
  sensors["temperature"] = 25.5;
  sensors["battery"] = 85;
  
  String json;
  serializeJson(doc, json);
  
  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  
  // WiFi setup...
  WiFi.begin(SSID, PASSWORD);
  
  // Register endpoint
  server.on("/status", HTTP_GET, handleStatus);
  
  server.begin();
  Serial.println("Server started");
}

void loop() {
  server.handleClient();
  delay(10);
}
```

## MicroPython Implementation Example

If you're using MicroPython on your ESP32:

```python
import json
import utime
from machine import Pin
from network import WLAN, STA_IF
import usocket as socket

class SimpleHTTPServer:
    def __init__(self, port=80):
        self.port = port
        self.socket = None
        self.start_time = utime.time()
    
    def start(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(('0.0.0.0', self.port))
        self.socket.listen(1)
        print(f"HTTP Server listening on port {self.port}")
    
    def handle_request(self):
        client, addr = self.socket.accept()
        
        try:
            request = client.recv(1024).decode()
            
            if "GET /status" in request:
                response = self.handle_status()
            else:
                response = "HTTP/1.1 404 Not Found\r\n\r\n"
            
            client.sendall(response.encode())
        finally:
            client.close()
    
    def handle_status(self):
        status_data = {
            "status": "ok",
            "device": "ESP32",
            "type": "telemetry",
            "name": "Boat Telemetry Unit",
            "version": "1.0.0",
            "uptime": int(utime.time() - self.start_time),
            "sensors": {
                "temperature": 25.5,
                "pressure": 1013.25,
                "battery": 85
            }
        }
        
        json_data = json.dumps(status_data)
        response = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: application/json\r\n"
            f"Content-Length: {len(json_data)}\r\n"
            "Connection: close\r\n"
            "\r\n"
            f"{json_data}"
        )
        
        return response

# Main setup
def main():
    # WiFi connection
    sta_if = WLAN(STA_IF)
    sta_if.active(True)
    sta_if.connect('SSID', 'PASSWORD')
    
    # Wait for connection
    while not sta_if.isconnected():
        utime.sleep(1)
    
    print('Connected:', sta_if.ifconfig())
    
    # Start server
    server = SimpleHTTPServer()
    server.start()
    
    # Handle requests
    while True:
        server.handle_request()

if __name__ == '__main__':
    main()
```

## Response Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | ✅ | Should be "ok" for healthy devices |
| `device` | string | ✅ | Device identifier (e.g., "ESP32") |
| `type` | string | ⚠️ | "telemetry" or "camera" for better type detection |
| `name` | string | ❌ | Human-readable device name |
| `version` | string | ❌ | Firmware version |
| `ip` | string | ❌ | Device's own IP address |
| `uptime` | number | ❌ | Seconds since device boot |
| `sensors` | object | ❌ | Sensor data object (telemetry) |
| `camera` | object | ❌ | Camera status object (camera) |

## Testing Your Endpoint

### From Browser

1. Find your ESP32's IP address (check your router)
2. Open browser and navigate to: `http://192.168.1.XXX/status`
3. You should see JSON response

### From Command Line

```bash
# Using curl
curl http://192.168.1.XXX/status

# Pretty print with jq
curl http://192.168.1.XXX/status | jq '.'
```

### From the App

1. Open Bridge Console
2. Tap the 🔍 SCAN button
3. Your device should appear in the list if `/status` responds

## Performance Considerations

### Response Time

- **Target**: < 1 second response time
- **Acceptable**: < 3 seconds (before scanner timeout)
- **Too slow**: > 5 seconds (scanner will timeout)

If your `/status` endpoint is slow:
1. Reduce the amount of data being processed
2. Cache sensor readings instead of reading on every request
3. Use lightweight JSON serialization

### Memory Usage

Keep the response compact:
- Minimal JSON structure
- Float precision as needed
- Avoid deep nested objects

### Network Load

The scanner will send ~250 parallel HTTP requests during a scan:
- Ensure your WiFi can handle simultaneous connections
- Consider implementing request throttling on the ESP32 if needed

## Troubleshooting

### Device Found But Not Connecting

If the device appears in scan but fails to connect:

1. **Test the endpoint directly:**
   ```bash
   curl -v http://192.168.1.XXX/status
   ```

2. **Check ESP32 logs** for any errors

3. **Verify WebServer is running** on your ESP32

### Device Not Appearing in Scan

1. **Verify device is online:** Ping it from your phone's network
   ```bash
   ping 192.168.1.XXX
   ```

2. **Check WiFi connection** on the ESP32

3. **Verify correct port:** Default is port 80

4. **Check firewall rules** on your network

### Slow Response Time

1. **Monitor ESP32 CPU usage** - may be overloaded
2. **Check WiFi signal strength** - weak signal causes slowdowns
3. **Reduce JSON payload** - less data = faster response

## Existing Firmware Notes

### boat_telemetry.ino

The telemetry device needs the `/status` endpoint if it doesn't have one:

```cpp
void setupWebServer() {
  // ... existing setup ...
  
  server.on("/status", HTTP_GET, handleStatus);
}

void handleStatus() {
  StaticJsonDocument<512> doc;
  doc["status"] = "ok";
  doc["device"] = "ESP32";
  doc["type"] = "telemetry";
  doc["name"] = "Boat Telemetry";
  doc["uptime"] = millis() / 1000;
  
  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}
```

### camera_stream.ino

The camera device needs the `/status` endpoint:

```cpp
void setupWebServer() {
  // ... existing setup ...
  
  server.on("/status", HTTP_GET, handleCameraStatus);
}

void handleCameraStatus() {
  StaticJsonDocument<512> doc;
  doc["status"] = "ok";
  doc["device"] = "ESP32";
  doc["type"] = "camera";
  doc["name"] = "Boat Camera";
  doc["camera"]["connected"] = cameraConnected;
  doc["uptime"] = millis() / 1000;
  
  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}
```

## Summary

**Minimum Requirements:**
- ✅ HTTP GET endpoint at `/status`
- ✅ Returns HTTP 200 OK
- ✅ Returns valid JSON
- ✅ Responds within 3 seconds

**Recommended:**
- ✅ Include `type` field ("telemetry" or "camera")
- ✅ Include device name for UI display
- ✅ Include relevant sensor/camera data

This ensures maximum compatibility with the device discovery feature!

