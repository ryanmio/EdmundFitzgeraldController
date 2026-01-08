# ESP32 Overheating Troubleshooting Guide

## Current Status
- Both old and new firmware cause overheating
- Bare ESP32 boots normally (no wiring)
- Buzzer disconnected but issue persists
- **Conclusion: Hardware short in wiring, NOT firmware**

---

## Systematic Isolation Test

### Step 1: Confirm baseline (DONE ✓)
- [x] Bare ESP32 with only 5V + GND → boots normally

### Step 2: Disconnect Flood MOSFET Circuit
**What to disconnect:**
- GPIO17 wire from ESP32 MOSFET gate
- GND wire from MOSFET to ESP32

**Test:** Power on ESP32
- [ ] Does it boot normally? → YES / NO

### Step 3: If still failing, disconnect Running Lights MOSFET
**What to disconnect:**
- GPIO16 wire from ESP32 MOSFET gate
- GND wire from MOSFET to ESP32

**Test:** Power on ESP32
- [ ] Does it boot normally? → YES / NO

### Step 4: If still failing, disconnect Water Sensor
**What to disconnect:**
- GPIO32 wire (sensor probe)
- GND wire (sensor reference)

**Test:** Power on ESP32
- [ ] Does it boot normally? → YES / NO

### Step 5: If still failing, disconnect Battery Voltage Divider
**What to disconnect:**
- GPIO34 wire (middle of resistor divider)
- Both 100kΩ and 47kΩ resistors (or at least disconnect from power)

**Test:** Power on ESP32
- [ ] Does it boot normally? → YES / NO

### Step 6: If still failing, disconnect RC Receiver
**What to disconnect:**
- GPIO18 wire (throttle)
- GPIO19 wire (servo/rudder)

**Test:** Power on ESP32
- [ ] Does it boot normally? → YES / NO

---

## When You Find the Problem

Once you identify which circuit causes the issue:
1. **Visually inspect that circuit** for:
   - Bare wires touching metal/hull
   - Solder bridges
   - Components touching each other
   - Damaged wire insulation
   - Loose connections

2. **Check with multimeter** (if available):
   - Set to continuity/beep mode
   - Test for shorts between power and ground in that circuit

---

## Socket/Header Issue Check

If you're using a socket to insert the ESP32:
- **Inspect socket pins** for bending
- **Check if any pins touch adjacent pins** when ESP32 is inserted
- **Look for corrosion** on socket pins

---

## Important Notes

- **Take your time** - rushing could damage another ESP32
- **After each disconnect, fully power off before testing**
- **Watch for overheating immediately** - pull power quickly if you see it
- **Document which circuit fails** - that's your culprit

---

## Expected Outcome

One of these circuits will cause the overheating. Once identified:
- Inspect that circuit thoroughly
- Fix the short
- Test with just that circuit
- Add back other circuits one by one to confirm fix

You're close! This is solvable. 🔧
