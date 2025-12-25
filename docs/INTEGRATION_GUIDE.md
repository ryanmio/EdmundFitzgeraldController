# Hardware Integration Guide

**Integration Day Checklist** - Step-by-step wiring guide for all components.

---

## POWER SYSTEM

1. **BEC Power Distribution**: Connect BEC 5V output to both ESP32 telemetry board (5V pin) and ESP32-CAM board (5V pin) in parallel.
2. **Shared Ground**: Connect BEC ground to both ESP32 boards' GND pins (common ground reference for all components).
3. **BEC Capacitor**: Add 470µF capacitor across BEC 5V and GND for power stability (optional but recommended).

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

## LED LIGHT CONTROL (MOSFET OUTPUTS)

12. **Running Lights MOSFET**: 
- VIN+ (screw) → Battery positive
- VIN- (screw) → Battery negative
- OUT+ (screw) → Light positive
- OUT- (screw) → Light negative
- GND pad (solder) → ESP32 GND
- TRIG/PWM pad (solder) → ESP32 GPIO16
13. **Flood Lights MOSFET**: 
- VIN+ (screw) → Battery positive
- VIN- (screw) → Battery negative
- OUT+ (screw) → Light positive
- OUT- (screw) → Light negative
- GND pad (solder) → ESP32 GND
- TRIG/PWM pad (solder) → ESP32 GPIO17

---

## ESP32-CAM SETUP

15. **Camera Power**: ESP32-CAM powered separately from same BEC 5V (see step 1) - no direct connections to telemetry board.
16. **Camera Ground**: ESP32-CAM GND connected to shared ground (see step 2).
17. **Camera Communication**: No wires needed - camera communicates with telemetry board and app via WiFi only.

---

## VERIFICATION CHECKLIST

- [ ] Both ESP32 boards power on and connect to WiFi
- [ ] Telemetry endpoint shows battery voltage (not 0.0V)
- [ ] Water sensor reads HIGH when dry, LOW when wet
- [ ] Throttle PWM shows 1000-2000µs range when moving RC stick
- [ ] Servo PWM shows 1000-2000µs range when moving RC stick
- [ ] Running lights toggle via app LED control
- [ ] Flood lights toggle via app LED control
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
| Flood Lights | GPIO17 | MOSFET gate output |

---

**Note**: All components share the same GND reference. Double-check all ground connections are common before powering on.

