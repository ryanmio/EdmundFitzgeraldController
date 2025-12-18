# EXPO APP BUILD PROMPT

Your task is to build a **minimal, working mobile app** that connects to a live ESP32 telemetry server and allows the user to monitor and control it from an iPhone.

## CONTEXT

**What Already Exists:**
- ESP32 running `firmware/boat_telemetry/boat_telemetry.ino` 
- HTTP API running on `172.20.10.4:80` (on iPhone hotspot)
- Three endpoints:
  - `GET /status` → JSON: `{connected, ip_address, uptime_seconds, running_led, flood_led}`
  - `GET /telemetry` → JSON: `{timestamp, battery_voltage, signal_strength, uptime_seconds, running_mode_state, flood_mode_state, connection_status, ip_address}`
  - `POST /led` → accepts `{mode: "running"|"flood", state: "on"|"off"}`

**User Profile:**
- Ryan: intermediate developer, built Swift apps, comfortable with Expo
- Prefers working code over perfection
- Will test on iPhone simulator (Xcode) via iPhone hotspot
- Wants to iterate quickly while waiting for camera hardware

## YOUR GOAL

Build a **3-screen Expo app MVP** that:
1. Connects to the ESP32 at a configurable IP
2. Polls `/telemetry` every 1 second and displays live data
3. Allows toggling running/flood LEDs via POST `/led`
4. Runs reliably for 5+ minutes without crashing
5. Stores the last-used IP address locally

## ACCEPTANCE CRITERIA

- [ ] App creates and runs with `npx expo start` → open in iPhone simulator
- [ ] **Connection Screen**: Manual IP entry, "Connect" button, status indicator (connecting/connected/failed)
- [ ] **Telemetry Screen**: Displays battery voltage, signal strength, uptime, connection status (refreshes every 1 second)
- [ ] **LED Control Screen**: Two toggle buttons (running/flood), POST requests work, UI confirms state change
- [ ] Navigation between three screens works smoothly
- [ ] App survives 5+ minutes of active use without crashes
- [ ] Error handling for network timeouts, malformed responses, offline mode
- [ ] Last IP stored in AsyncStorage and auto-populated on app restart

## YOUR PLAN

1. **Determine what to do first** — break the work into phases (e.g., scaffolding, connection screen, telemetry, LED control)
2. **Make decisions** about UI library (React Native built-ins? or a UI kit like NativeBase/Tamagui?)
3. **Create the project** and folder structure
4. **Build and test each screen** independently before combining
5. **Iterate** based on what works and what doesn't

## KEY CONSTRAINTS

- **No camera integration yet** — skip `/stream` endpoint for now
- **Keep it simple** — text displays, simple buttons, no fancy animations
- **Use fetch** for HTTP (no external HTTP libraries unless needed)
- **Use AsyncStorage** for IP persistence (no SQLite/Redux unless you need it)
- **Test on iPhone simulator** via iPhone hotspot (make sure Mac is on `Ryan's iPhone 17 Pro`)

## HOW TO REFERENCE EXISTING DOCS

- `/docs/prompt.md` has the full project context and Phase 2 checkpoint
- The endpoint specifications are in `/docs/prompt.md` under "Telemetry Specification"
- Firmware is in `firmware/boat_telemetry/boat_telemetry.ino` if you need to understand request/response formats

## SUGGESTED TECH STACK

- **React Native** with Expo
- **React Navigation** (stack navigator)
- **AsyncStorage** (IP storage)
- **fetch** (HTTP client)
- **React Hooks** (useState, useEffect, useCallback)

## WHAT SUCCESS LOOKS LIKE

After your work:
- Ryan can start the app on his iPhone simulator
- Type in `172.20.10.4`
- See live telemetry updating every second
- Toggle LEDs and watch the state change
- Close and reopen the app → IP is remembered
- Everything works smoothly for 5+ minutes

---

**Your turn: Plan the build, create the project, and execute. Reference this prompt and the docs as needed. Make decisions confidently and iterate based on feedback.**

