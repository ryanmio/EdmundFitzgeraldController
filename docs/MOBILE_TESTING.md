# MOBILE TESTING GUIDE - Expo Go & iPhone Simulator

**Objective:** Verify the boat telemetry app works reliably on iOS (both simulator and physical iPhone) using free, local testing methods.

**Constraints:**
- macOS 13.7 (cannot upgrade to newer Xcode or iOS 18+ features)
- iPhone simulator available (tested before on older iOS)
- Physical iPhone available for QR code scanning
- NO cloud builds (EAS Build) — testing only
- Want to continue web development for speed, but validate mobile compatibility

---

## PHASE 1: LOCAL SIMULATOR TESTING

### Goal
Verify the app runs in iPhone simulator without crashes for 5+ minutes.

### Prerequisites
- Xcode installed (current version works with macOS 13.7 for iOS 16/17 simulators)
- Boat telemetry ESP32 running and connected to home WiFi (`.hidden`)
- Mac on same WiFi network as ESP32

### Steps

1. **Start the app development server (web mode first to validate)**
   ```bash
   cd /Users/ryanmioduskiimac/Documents/GitHub/EdmundFitzgeraldController/boat-telemetry-app
   npx expo start --web
   ```
   - Open `http://localhost:8081` in browser
   - Confirm app loads, can connect to ESP32, telemetry displays
   - Verify LED toggles work

2. **Boot iOS simulator manually**
   ```bash
   open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app
   ```
   - Wait for simulator to fully boot (can take 30–60 seconds)
   - In Xcode, select **iPhone 15** (or any model iOS 16/17)

3. **Start Expo server targeting simulator**
   ```bash
   cd boat-telemetry-app
   npx expo start
   # Press 'i' to open in iOS simulator
   # DO NOT auto-launch; wait for manual boot
   ```

4. **Validate on simulator (5–10 min test)**
   - App should load (may take 20–30 seconds first time)
   - Connect to telemetry ESP32 IP (e.g., `192.168.1.185`)
   - Watch telemetry update every 1 second
   - Toggle Running LED, toggle Flood LED
   - Check battery voltage displays correctly
   - Check water intrusion displays (DRY by default)
   - **Observation window:** Keep app open for 5+ minutes
   - Watch for:
     - Memory leaks (app getting slower)
     - Crashes (white screen / error)
     - WiFi drops / reconnection delays
     - Battery voltage reading stability

5. **Test disconnect flow**
   - Tap power button (⏻) in header
   - Confirm confirmation dialog appears
   - Tap "Disconnect"
   - Should return to Connection Screen
   - Enter IP again, should reconnect

### Success Criteria (Phase 1)
- ✅ App loads in simulator without crashing
- ✅ Connects to ESP32 and fetches telemetry
- ✅ Displays battery voltage, signal strength, uptime, LED states
- ✅ LED toggles respond (POST requests work)
- ✅ No crashes during 5+ minute run
- ✅ Disconnect / reconnect works smoothly

### Troubleshooting Phase 1
| Issue | Solution |
|-------|----------|
| Simulator won't boot | Quit Simulator, delete from Dock, reopen Xcode and try again |
| App stays blank | Press 'r' in Expo terminal to rebuild. Clear Metro cache: `npx expo start --clear` |
| Can't connect to ESP32 | Check ESP32 is on same WiFi (home `.hidden`), ping `192.168.1.185` from Mac |
| "net::ERR_NAME_NOT_RESOLVED" | Strip `http://` from IP input if you typed it. App auto-corrects, but double-check |
| App crashes on load | Check console: `npx expo start` shows logs. Look for missing dependencies or bad state |

---

## PHASE 2: PHYSICAL DEVICE TESTING (QR Code)

### Goal
Verify app works on actual iPhone with real network conditions and performance.

### Prerequisites
- iPhone running iOS 15+ (any recent model)
- Expo Go app installed (download from App Store, free)
- iPhone on **same WiFi as ESP32** (home `.hidden` network)
- Mac also on same WiFi (or iPhone hotspot as fallback)

### Steps

1. **Prepare Expo server**
   ```bash
   cd boat-telemetry-app
   npx expo start
   ```
   - Do NOT press 'i' for simulator this time
   - Terminal shows QR code (should appear within 10 seconds)

2. **Scan QR code on iPhone**
   - Open **Expo Go** app on iPhone (or Camera app → tap notification)
   - Point at terminal QR code
   - App should launch after 10–20 seconds (first load is slow)

3. **Validate on physical device (10+ min test)**
   - Connect to telemetry ESP32 IP (`192.168.1.185`)
   - Watch telemetry stream (1-second polling)
   - Toggle LEDs several times
   - Simulate WiFi interruption (turn WiFi off for 5 seconds, turn back on)
     - Should show error banner
     - Should auto-reconnect within 30 seconds
   - **Keep app open for 10+ minutes** in foreground
   - Observation points:
     - Does app feel responsive / snappy?
     - Any UI lag or stutter?
     - Battery drain noticeable?
     - Connection stable?

4. **Test background behavior (optional)**
   - Put app in background (home button)
   - Wait 30 seconds
   - Bring back to foreground
   - Should resume polling without manual reconnect

### Success Criteria (Phase 2)
- ✅ QR code scans and launches app in Expo Go
- ✅ App connects to ESP32 over WiFi
- ✅ Telemetry updates smooth and responsive
- ✅ LED toggles work (POST requests succeed)
- ✅ No crashes during 10+ minute run
- ✅ WiFi drop/reconnection handled gracefully
- ✅ App responsive in foreground (no freezes)

### Troubleshooting Phase 2
| Issue | Solution |
|-------|----------|
| QR code doesn't scan | Make sure Expo server is running and terminal shows QR. Try `npx expo start --clear` |
| App crashes on iPhone | Check phone WiFi is on home `.hidden` network. Check phone has ~100MB free storage. Look at terminal logs from `expo start` |
| App connects but no telemetry | Verify ESP32 IP is `192.168.1.185`. Ping it from iPhone (using a network scanner app if needed) |
| WiFi drop test fails (doesn't reconnect) | This is expected behavior for now. Note it and we'll add better reconnection logic if needed |
| App is slow / laggy | Normal for first load. Refresh by pulling down (if implemented) or killing and reopening Expo Go |

---

## PHASE 3: CONTINUE WEB DEVELOPMENT

Once both simulator and physical device pass **Phase 1 & 2**, you can safely continue iterating on web while knowing mobile compatibility is solid.

### Development workflow
```bash
# Terminal 1: Web dev (for rapid iteration)
npx expo start --web

# Terminal 2 (when needed): Test on mobile
npx expo start
# (press 'i' for simulator or scan QR on device)
```

**When to test on mobile:**
- Before major feature additions
- After significant state/routing changes
- Before committing to main branch

**What NOT to test on mobile yet:**
- Camera stream (different board, separate firmware)
- Advanced animations (low-priority UI polish)
- Native module integrations (not planned yet)

---

## TEST CHECKLIST

### Pre-test
- [ ] ESP32 powered on and connected to WiFi (check serial monitor if needed)
- [ ] Telemetry endpoint responds: `curl http://192.168.1.185/telemetry`
- [ ] Mac/iPhone on same WiFi as ESP32
- [ ] `npm install` complete (no missing dependencies)
- [ ] No stale node_modules or cache: `rm -rf node_modules/.cache` if needed

### Simulator Phase
- [ ] Xcode simulator launches without error
- [ ] Expo connects and loads app
- [ ] Connection screen appears
- [ ] Can enter ESP32 IP
- [ ] Telemetry displays and updates every 1 second
- [ ] Battery voltage shows correct value (~8.4V if fully charged)
- [ ] Water sensor shows "DRY"
- [ ] LED toggles work (visual feedback on app)
- [ ] Power button shows confirmation dialog
- [ ] Disconnect works, can reconnect
- [ ] **5+ minute run:** No crashes, no slowdown

### Physical Device Phase
- [ ] Expo Go installed and opens
- [ ] QR code scans without issues
- [ ] App launches on iPhone
- [ ] Same telemetry validations as simulator
- [ ] **10+ minute run:** Smooth, responsive, stable
- [ ] WiFi drop test: Error shown, reconnects within 30 seconds
- [ ] No noticeable battery drain during test

### After Testing
- [ ] Document any issues found
- [ ] Commit working state: `git add -A && git commit -m "Mobile testing validated on simulator + iPhone Expo Go"`
- [ ] Update `docs/plan.md` with mobile validation status
- [ ] Continue web dev or move to next feature

---

## EXPECTED LIMITATIONS (macOS 13.7)

- **iOS version capped at 17.x** (can't test iOS 18 features)
- **No latest design systems** (Liquid Glass, Dynamic Island, etc.)
- **Simulator performance slower** than real device or latest Mac
- **No native module testing** (bluetooth, camera access, etc.)

These are acceptable for MVP validation. If those features are needed later, you can explore EAS Build or upgrade to newer Mac.

---

## NEXT STEPS AFTER MOBILE VALIDATION

1. **If all tests pass:**
   - Update plan as "Mobile Validated"
   - Continue web dev with confidence
   - Prepare for LED hardware integration (waiting for MOSFETs)
   - Plan stability test (30+ minute runtime)

2. **If issues found:**
   - Debug based on error messages
   - Iterate quickly on web
   - Re-test on mobile after fixes

3. **When ready for deployment:**
   - Consider EAS Build (if you want App Store submission)
   - Or keep Expo Go for testing/internal use

---

**You're testing for confidence, not perfection. If it works on simulator + iPhone for 10+ minutes without crashing, you're good to ship an MVP.**

