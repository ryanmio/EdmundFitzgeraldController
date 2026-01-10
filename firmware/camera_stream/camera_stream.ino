/*
 * camera_stream.ino
 * Minimal ESP32-CAM firmware for MJPEG streaming
 * Serves /stream endpoint with CORS headers for web app integration
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "secrets.h"

// ==================== CAMERA MODEL ====================
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// ==================== BUILD IDENTIFICATION ====================
#define FIRMWARE_VERSION   "1.0.0"
#define BUILD_ID           "20260109"             // YYYYMMDD format

// ==================== GLOBALS ====================
httpd_handle_t stream_httpd = NULL;
httpd_handle_t control_httpd = NULL;

// ==================== WIFI CONNECT ====================
void connectWiFi() {
  Serial.println();
  Serial.println("Scanning for WiFi networks...");

  WiFi.mode(WIFI_STA);
  int numNetworks = WiFi.scanNetworks();
  
  Serial.print("Networks found: ");
  Serial.println(numNetworks);
  
  String ssidToConnect = "";
  String passwordToUse = "";
  bool foundHomeWiFi = false;
  
  for (int i = 0; i < numNetworks; i++) {
    String scannedSSID = WiFi.SSID(i);
    Serial.print("[");
    Serial.print(i);
    Serial.print("] ");
    Serial.println(scannedSSID);
    
    if (scannedSSID == HOME_WIFI_SSID) {
      ssidToConnect = scannedSSID;
      passwordToUse = HOME_WIFI_PASSWORD;
      foundHomeWiFi = true;
      Serial.println(">>> Matched home WiFi");
      break;
    }
  }
  
  // Fallback to iPhone hotspot
  if (!foundHomeWiFi) {
    for (int i = 0; i < numNetworks; i++) {
      String scannedSSID = WiFi.SSID(i);
      if (scannedSSID == HOTSPOT_SSID) {
        ssidToConnect = scannedSSID;
        passwordToUse = HOTSPOT_PASSWORD;
        Serial.print(">>> Using iPhone hotspot: ");
        Serial.println(ssidToConnect);
        break;
      }
    }
  }

  if (ssidToConnect.length() == 0) {
    Serial.println("No known networks found!");
    return;
  }

  Serial.print("Connecting to: ");
  Serial.println(ssidToConnect);
  WiFi.begin(ssidToConnect.c_str(), passwordToUse.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("Camera stream available at: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/stream");
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
  }
}

// ==================== MJPEG STREAM HANDLER ====================
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;
  char part_buf[64];

  // CORS headers - very permissive for web app access
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");
  httpd_resp_set_hdr(req, "X-Framerate", "10");

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    return res;
  }

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
    } else {
      if (fb->format != PIXFORMAT_JPEG) {
        bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
        esp_camera_fb_return(fb);
        fb = NULL;
        if (!jpeg_converted) {
          Serial.println("JPEG compression failed");
          res = ESP_FAIL;
        }
      } else {
        _jpg_buf_len = fb->len;
        _jpg_buf = fb->buf;
      }
    }

    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }

    if (fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if (_jpg_buf) {
      free(_jpg_buf);
      _jpg_buf = NULL;
    }

    if (res != ESP_OK) {
      break;
    }
  }

  return res;
}

// ==================== STATUS HANDLER ====================
esp_err_t status_handler(httpd_req_t *req) {
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_type(req, "application/json");
  
  char json[256];
  snprintf(json, sizeof(json),
    "{\"firmware_version\":\"%s\",\"build_id\":\"%s\",\"camera\":\"online\",\"ip\":\"%s\",\"rssi\":%d}",
    FIRMWARE_VERSION,
    BUILD_ID,
    WiFi.localIP().toString().c_str(),
    WiFi.RSSI()
  );
  
  return httpd_resp_sendstr(req, json);
}

// ==================== STILL IMAGE HANDLER ====================
esp_err_t still_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");

  fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  if (fb->format != PIXFORMAT_JPEG) {
    bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
    esp_camera_fb_return(fb);
    if (!jpeg_converted) {
      httpd_resp_send_500(req);
      return ESP_FAIL;
    }
  } else {
    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=frame.jpg");
  res = httpd_resp_send(req, (const char *)_jpg_buf, _jpg_buf_len);

  if (fb) {
    esp_camera_fb_return(fb);
  } else if (_jpg_buf) {
    free(_jpg_buf);
  }

  return res;
}

// ==================== OPTIONS HANDLER (CORS) ====================
esp_err_t options_handler(httpd_req_t *req) {
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
}

// ==================== START SERVER ====================
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  // Stream endpoint
  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  // Still frame endpoint (single JPEG)
  httpd_uri_t still_uri = {
    .uri       = "/still",
    .method    = HTTP_GET,
    .handler   = still_handler,
    .user_ctx  = NULL
  };

  // Status endpoint
  httpd_uri_t status_uri = {
    .uri       = "/status",
    .method    = HTTP_GET,
    .handler   = status_handler,
    .user_ctx  = NULL
  };

  // CORS preflight
  httpd_uri_t options_uri = {
    .uri       = "/stream",
    .method    = HTTP_OPTIONS,
    .handler   = options_handler,
    .user_ctx  = NULL
  };

  Serial.println("Starting camera server...");
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &still_uri);
    httpd_register_uri_handler(stream_httpd, &status_uri);
    httpd_register_uri_handler(stream_httpd, &options_uri);
    Serial.println("Camera server started on port 80");
    Serial.println("  /stream  - MJPEG stream");
    Serial.println("  /still   - Single JPEG frame");
    Serial.println("  /status  - JSON status");
  }
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();
  Serial.println("=== ESP32-CAM Stream Server ===");

  // Camera configuration
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;

  // Optimized for streaming stability
  config.frame_size = FRAMESIZE_QVGA;  // 320x240
  config.jpeg_quality = 20;             // Higher = more compression
  config.fb_count = 2;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  // Init camera with retry logic
  esp_err_t err = ESP_FAIL;
  int retries = 0;
  while (err != ESP_OK && retries < 3) {
    err = esp_camera_init(&config);
    if (err != ESP_OK) {
      Serial.printf("Camera init failed with error 0x%x (attempt %d/3)\n", err, retries + 1);
      delay(1000);
      retries++;
    }
  }
  
  if (err != ESP_OK) {
    Serial.println("Camera init failed after 3 attempts. Rebooting...");
    delay(1000);
    ESP.restart();
  }
  Serial.println("Camera initialized");
  
  // Verify camera can actually capture frames
  Serial.println("Testing frame capture...");
  camera_fb_t *test_fb = esp_camera_fb_get();
  if (!test_fb) {
    Serial.println("Camera init reported success but cannot capture frames! Rebooting...");
    delay(1000);
    ESP.restart();
  }
  esp_camera_fb_return(test_fb);
  Serial.println("Frame capture verified - camera fully operational");

  // Apply additional sensor settings
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_framesize(s, FRAMESIZE_QVGA);
    s->set_quality(s, 20);
    s->set_brightness(s, 0);
    s->set_contrast(s, 0);
    s->set_saturation(s, 0);
  }

  // Connect WiFi
  connectWiFi();

  // Start server
  startCameraServer();

  Serial.println("=== Camera Ready ===");
}

// ==================== LOOP ====================
void loop() {
  // Reconnect WiFi if disconnected
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 30000) {
    lastCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi lost, reconnecting...");
      connectWiFi();
    }
  }
  delay(10);
}

