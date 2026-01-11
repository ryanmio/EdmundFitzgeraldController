# Hardware Integration Guide

**Integration Day Checklist** - Step-by-step wiring guide for all components.

---

## POWER SYSTEM

1. **BEC Power Distribution**: Connect BEC 5V output to both ESP32 telemetry board (5V pin) and ESP32-CAM board (5V pin) in parallel.
2. **Shared Ground**: Connect BEC ground to both ESP32 boards' GND pins (common ground reference for all components).
3. **BEC Capacitor**: Connect 470µF electrolytic capacitor positive leg to BEC 5V output, negative leg to BEC GND (mount close to BEC for noise filtering).

---

## WATER INTRUSION SENSOR

4. **Sensor Installation**: Install two stainless steel screws at bottom of boat hull (spaced 5-10mm apart, no nearby metal).
5. **Sensor Wiring**: Wrap wire around one screw (sensor probe), connect to GPIO32 on ESP32 telemetry board.
6. **Ground Reference**: Connect other screw (ground probe) to ESP32 GND pin.

---

## BATTERY VOLTAGE MONITORING

7. **Voltage Divider**: Wire 100kΩ resistor from battery positive to GPIO34, then 47kΩ resistor from GPIO34 to GND.
8. **Battery Connection**: Connect battery positive to the 100kΩ resistor input (top of divider).

---

## RC RECEIVER INTEGRATION

9. **Throttle Channel**: Connect RC receiver throttle channel signal wire to GPIO18 on ESP32 telemetry board.
10. **Servo/Rudder Channel**: Connect RC receiver servo/rudder channel signal wire to GPIO19 on ESP32 telemetry board.
11. **RC Receiver Ground**: Connect RC receiver ground to ESP32 GND (shared ground).

---

## RUNNING LIGHTS (MOSFET CONTROLLED)

12. **Running Lights MOSFET**: 
- VIN+ (screw) → BEC 5V (or battery positive for 12V lights)
- VIN- (screw) → BEC GND (or battery negative)
- OUT+ (screw) → Light positive (or resistor input for parallel LEDs)
- OUT- (screw) → Light negative (or parallel group ground)
- GND pad (solder) → ESP32 GND
- TRIG/PWM pad (solder) → ESP32 GPIO16

---

## FLOOD LIGHTS (MOSFET CONTROLLED)

13. **Flood Lights MOSFET**: 
- VIN+ (screw) → BEC 5V (or battery positive for 12V lights)
- VIN- (screw) → BEC GND (or battery negative)
- OUT+ (screw) → Flood light positive (high-power LED array or floodlight)
- OUT- (screw) → Flood light negative (or array ground)
- GND pad (solder) → ESP32 GND
- TRIG/PWM pad (solder) → ESP32 GPIO21
- **Indicator LED** (optional): Small LED + 470Ω resistor between GPIO4 and GND for visual feedback

---

## AUDIO OUTPUT (DFPLAYER + SPEAKER)

**DFPlayer Mini MP3 module with 128MB onboard storage**

14. **DFPlayer Wiring**:
- VCC → BEC 5V
- GND → ESP32 GND
- TX → ESP32 GPIO25
- RX → ESP32 GPIO26
- SPK_1 → Speaker positive (red)
- SPK_2 → Speaker negative (black)

**Track Mapping (Chronological):**
- 001.mp3 = Radio 1 ("Fence rail down, vents lost") - 3:30 PM
- 002.mp3 = Radio 2 ("Lost both radars") - 5:20 PM  
- 003.mp3 = Radio 3 ("We are holding our own") - 7:10 PM final
- 004.mp3 = Horn (optional)
- 005.mp3 = SOS (optional)

---

## ESP32-CAM SETUP

17. **Camera Power**: ESP32-CAM powered separately from same BEC 5V (see step 1) - no direct connections to telemetry board.
18. **Camera Ground**: ESP32-CAM GND connected to shared ground (see step 2).
19. **Camera Communication**: No wires needed - camera communicates with telemetry board and app via WiFi only.

---

## INCREMENTAL TESTING PROCEDURE

**Do not wire everything at once.** Follow this sequence:

### Phase 1: Power Only
- [ ] Connect only BEC 5V + GND to ESP32
- [ ] Power on → ESP32 boots, LED blinks, connects to WiFi
- [ ] If fails: Check BEC output, check polarity

### Phase 2: Add Water Sensor
- [ ] Power off
- [ ] Connect water sensor (GPIO32 + GND)
- [ ] Multimeter test: 5V↔GND still >100Ω?
- [ ] Power on → Telemetry shows water sensor reading
- [ ] If fails: Disconnect, check wiring

### Phase 3: Add Battery ADC
- [ ] Power off
- [ ] Connect voltage divider (GPIO34)
- [ ] Multimeter test: 5V↔GND still >100Ω?
- [ ] Power on → Telemetry shows battery voltage
- [ ] If fails: Disconnect, check resistor values/wiring

### Phase 4: Add Running Lights MOSFET
- [ ] Power off
- [ ] Connect MOSFET (VIN, OUT, GND pad, TRIG to GPIO16)
- [ ] Multimeter test: 5V↔GND still >100Ω?
- [ ] Power on → Toggle running lights via app
- [ ] If fails: Disconnect MOSFET GND first, check wiring

### Phase 5: Add Flood Lights MOSFET
- [ ] Power off
- [ ] Connect MOSFET (VIN, OUT, GND pad, TRIG to GPIO21)
- [ ] (Optional) Connect indicator LED to GPIO4
- [ ] Multimeter test: 5V↔GND still >100Ω?
- [ ] Power on → Toggle flood lights via app
- [ ] If fails: Disconnect MOSFET GND first, check wiring

### Phase 6: Add Audio (DFPlayer + Speaker)

**v2.0 Implementation**: DFPlayer Mini with onboard 128MB storage
- [ ] Power off
- [ ] Wire DFPlayer: VCC→5V, GND→GND, TX→GPIO25, RX→GPIO26, SPK_1→Speaker+, SPK_2→Speaker-
- [ ] Upload MP3s to DFPlayer via USB (rename: fence_down→001.mp3, lost_radar→002.mp3, holding_own→003.mp3)
- [ ] Flash updated firmware v2.0.0 to ESP32 (requires `DFRobotDFPlayerMini` library)
- [ ] Power on → Test horn, SOS, and radio sounds via app

### Phase 7: Add RC Receiver
- [ ] Power off
- [ ] Connect RC receiver (GPIO18, GPIO19, GND)
- [ ] Multimeter test: 5V↔GND still >100Ω?
- [ ] Power on → Telemetry shows PWM values

### Phase 8: Add Camera
- [ ] Power off
- [ ] Connect ESP32-CAM (5V, GND only - no signal wires)
- [ ] Power on → Camera stream accessible

---

## VERIFICATION CHECKLIST

- [ ] Both ESP32 boards power on and connect to WiFi
- [ ] Telemetry endpoint shows battery voltage (not 0.0V)
- [ ] Water sensor reads HIGH when dry, LOW when wet
- [ ] Throttle PWM shows 1000-2000µs range when moving RC stick
- [ ] Servo PWM shows 1000-2000µs range when moving RC stick
- [ ] Running lights toggle via app LED control
- [ ] Flood lights toggle via app LED control
- [ ] Horn sound plays when button pressed (LOUD)
- [ ] SOS sound plays when button held (LOUD morse code)
- [ ] Radio 1/2/3 sounds play when buttons pressed (quieter background tones)
- [ ] Camera stream accessible at `/stream` endpoint

---

## PIN SUMMARY (Telemetry ESP32)

| Component | Pin | Notes |
|-----------|-----|-------|
| Water Sensor | GPIO32 | Has internal pullup |
| Battery ADC | GPIO34 | ADC input only |
| Throttle PWM | GPIO18 | Digital input |
| Servo PWM | GPIO19 | Digital input |
| Running Lights | GPIO16 | MOSFET gate output |
| Flood Lights (indicator) | GPIO4 | Optional indicator LED |
| Flood Lights | GPIO21 | MOSFET gate output |
| DFPlayer TX | GPIO25 | Serial to DFPlayer |
| DFPlayer RX | GPIO26 | Serial from DFPlayer |

---

---

**Note**: All components share the same GND reference. Double-check all ground connections are common before powering on.

---

