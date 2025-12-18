# Boat Telemetry & Control System - Project Plan

**Last Updated:** December 18, 2025  
**Status:** Phase 2-3 Complete ✅ | Phase 4 In Progress

---

## PROJECT OVERVIEW

Build a complete WiFi-based RC boat monitoring and control system with:
- **ESP32** running dual-network firmware with auto-WiFi selection
- **Expo web app** for real-time telemetry monitoring and LED control
- Modular architecture ready for camera integration and data logging

---

## PHASES & STATUS

### ✅ PHASE 1: SENSOR & CAMERA SCOPING - COMPLETE

**Decisions Locked In:**
- **Camera**: ESP32-CAM with OV2640 (ordered, awaiting delivery)
- **Telemetry**: Battery voltage + WiFi RSSI + uptime (essentials covered)
- **Power**: Using 5V from ESC/BEC + 470µF capacitor for stability
- **Budget**: <$100 for all hardware

**Deliverables:**
- Shopping list created
- Component sourcing in progress

---

### ✅ PHASE 2: ESP32 FIRMWARE DEVELOPMENT - COMPLETE

**Status:** Core HTTP API fully functional on home WiFi

**What's Working:**
- ✅ Dual WiFi network support:
  - Primary: Home WiFi `.hidden` (with password)
  - Fallback: iPhone hotspot `Ryan's iPhone 17 Pro`
  - Auto-selection with proper debugging output
- ✅ HTTP endpoints:
  - `GET /status` → returns `{connected, ip_address, uptime_seconds, running_led, flood_led}`
  - `GET /telemetry` → returns `{timestamp, battery_voltage, signal_strength, uptime_seconds, running_mode_state, flood_mode_state, connection_status, ip_address}`
  - `POST /led` → accepts `{mode: "running"|"flood", state: "on"|"off"}`
  - `GET /stream` → placeholder (camera integration pending)
  - `OPTIONS` handlers for CORS support
- ✅ CORS headers on all endpoints (browser compatibility)
- ✅ WiFi reconnection logic (30s retry)
- ✅ Serial output debugging

**Known Limitations:**
- Battery voltage shows `0.0V` (ADC not wired yet)
- LED pins are GPIO 2 and 4 (not 19/22 as originally planned)

**Test Results:**
- Connected on home WiFi: `192.168.1.178`
- All endpoints responding correctly
- LED control working via POST requests
- Telemetry updating reliably

**Location:** `/firmware/boat_telemetry/boat_telemetry.ino`

---

### ✅ PHASE 3: REACT NATIVE/EXPO APP DEVELOPMENT - COMPLETE

**Status:** Web app running and connected to ESP32

**What's Built:**

1. **Connection Screen**
   - Manual IP entry (pre-filled with `192.168.1.178`)
   - IP persistence in AsyncStorage
   - Connection status indicator (idle/connecting/connected/failed)
   - Error handling with timeouts

2. **Telemetry Screen**
   - 1-second polling from `/telemetry` endpoint
   - Displays: battery voltage, signal strength, uptime, ESP32 status, LED states
   - Error banner for connection issues
   - Navigation to LED Control
   - Responsive 2-column card layout

3. **LED Control Screen**
   - Toggle buttons for Running & Flood LEDs
   - Visual state feedback (colors + indicator dots)
   - POST requests to `/led` endpoint
   - Loading states during toggle

**Architecture:**
```
boat-telemetry-app/
├── App.tsx                          # Navigation setup (stack navigator)
├── src/
│   ├── screens/
│   │   ├── ConnectionScreen.tsx     # IP input + connection
│   │   ├── TelemetryScreen.tsx      # Live data display
│   │   └── LEDControlScreen.tsx     # LED toggles
│   ├── services/
│   │   ├── esp32Service.ts          # HTTP client (5s timeout)
│   │   └── storageService.ts        # AsyncStorage wrapper
│   └── types/
│       └── index.ts                 # TypeScript types
└── package.json
```

**Tech Stack:**
- React Native with Expo (web build)
- React Navigation for navigation
- AsyncStorage for IP persistence
- Native `fetch` for HTTP (with timeout wrapper)
- TypeScript for type safety
- Dark maritime theme (navy/white)

**Features:**
- ✅ Cross-origin (CORS) compatible
- ✅ Error handling + timeouts
- ✅ IP memory between sessions
- ✅ Responsive layout
- ✅ Real-time polling

**Running:**
```bash
cd boat-telemetry-app
npm install
npx expo start --web
# Open http://localhost:8081
```

**Location:** `/boat-telemetry-app/`

---

### 🔄 PHASE 4: INTEGRATION & TESTING - IN PROGRESS

**Completed:**
- ✅ Web app successfully connects to ESP32 on home WiFi
- ✅ Telemetry data displaying correctly
- ✅ LED control responding to user input
- ✅ No crashes during initial testing
- ✅ Connection recovery working

**Next Steps:**
1. Extended 15+ minute stability test
2. WiFi dropout/reconnection testing
3. LED physical verification
4. Battery voltage ADC implementation
5. Build native iOS app for TestFlight (if Xcode upgrade feasible)

**Success Criteria:**
- [ ] 15+ minute runtime without crashes
- [ ] All telemetry values accurate
- [ ] LED toggles reliable
- [ ] WiFi reconnection working smoothly
- [ ] Error handling robust

---

## DEPLOYMENT CHECKLIST

### Current Status:
- [x] ESP32 firmware compiled and running
- [x] WiFi auto-connect working (home WiFi priority)
- [x] HTTP endpoints functional
- [x] Web app built and running
- [x] App connects to ESP32 successfully
- [ ] Battery voltage ADC wired
- [ ] Extended stability testing
- [ ] Camera hardware integrated
- [ ] Native iOS build
- [ ] TestFlight deployment

### For Production:
1. **Hardware:**
   - Wire battery voltage divider (100kΩ + 47kΩ → GPIO 34)
   - Integrate ESP32-CAM when hardware arrives
   - Test in waterproof enclosure
   - Add 5V buck regulator if needed

2. **Software:**
   - Add data logging screen
   - Implement CSV export
   - Add camera MJPEG display
   - Build native iOS app

3. **Testing:**
   - 30-minute runtime test
   - Camera stream latency check
   - Data logging accuracy verification
   - Water test in enclosure

---

## KEY FILES & LOCATIONS

**Firmware:**
- `firmware/boat_telemetry/boat_telemetry.ino` - Main sketch
- `firmware/boat_telemetry/secrets.h` - WiFi credentials (gitignored)

**App:**
- `boat-telemetry-app/` - Complete Expo project
- `boat-telemetry-app/src/screens/` - UI screens
- `boat-telemetry-app/src/services/` - HTTP & storage clients

**Docs:**
- `docs/EXPO_APP_BUILD.md` - MVP requirements
- `docs/plan.md` - This file (project plan & progress)

---

## TECHNICAL DECISIONS

| Decision | Choice | Rationale |
|----------|--------|-----------|
| WiFi Strategy | Home WiFi primary + iPhone fallback | Maximum flexibility for different use cases |
| Web vs Native | Started with web, can build native later | Faster iteration, CORS workaround in place |
| HTTP Client | Native fetch with timeout | No external dependencies, simple & reliable |
| Storage | AsyncStorage | Lightweight, good for simple IP persistence |
| Styling | React Native StyleSheet | Standard, dark maritime theme chosen |

---

## NEXT SESSION TODO

1. **Extended Testing (15-30 min)**
   - Monitor for crashes/memory issues
   - Test WiFi reconnection scenarios
   - Verify LED state consistency

2. **Battery ADC Implementation**
   - Wire voltage divider to GPIO 34
   - Update firmware to read ADC
   - Display real battery voltage

3. **Data Logging Feature**
   - Add logging screen
   - Implement CSV export
   - Test data accuracy

4. **Camera Integration (When Hardware Arrives)**
   - Integrate ESP32-CAM into firmware
   - Implement MJPEG streaming
   - Add camera view to app

5. **Native iOS Build**
   - Upgrade Xcode if needed
   - Build for iPhone simulator
   - Test on actual device

---

## NOTES

- **Working IP**: `192.168.1.178` (home WiFi)
- **App Running**: `http://localhost:8081` (web build)
- **Serial Baud**: 115200
- **API Timeout**: 5 seconds
- **Telemetry Poll**: 1 second

All systems functional and ready for extended field testing! 🚀

