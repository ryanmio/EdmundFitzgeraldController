## Firmware (Arduino IDE)

This folder contains the Arduino sketches for the boat project.

### Pre-camera bring-up (do this now)

Open `firmware/boat_telemetry/boat_telemetry.ino` in Arduino IDE and flash it to your existing ESP32 dev board.

#### Setup

1. Copy `firmware/boat_telemetry/secrets.h.example` to `firmware/boat_telemetry/secrets.h`
2. Edit `secrets.h` with your WiFi SSID + password
3. In Arduino IDE:
   - Board: your ESP32 dev board (e.g. "ESP32 Dev Module")
   - Port: your USB serial port
4. Upload, then open Serial Monitor at **115200 baud**

#### Test

- Visit `http://<esp32-ip>/status`
- Visit `http://<esp32-ip>/telemetry`
- Toggle LEDs with:

```bash
curl -X POST http://<esp32-ip>/led \
  -H 'Content-Type: application/json' \
  -d '{"mode":"running","state":"on"}'
```

### RC non-interference rule (important)

- Do **not** connect ESP32 GPIO pins to RC receiver/servo/ESC **signal** pins.
- If you share power, share **GND only** (common ground) and keep wiring tidy.
- Start powered from your ESC/BEC 5V, and add a **470–1000µF capacitor** near ESP32 power input to reduce brownouts.


