# Engine Audio Diagnostic Sketch

Standalone test sketch for the I2S/MAX98357A engine audio system. Tests audio hardware **without needing the RC receiver or boat**.

## Purpose

Use this to:
- ✅ Verify MAX98357A I2S amplifier is working
- ✅ Test audio engine rendering (pitch/volume control)
- ✅ Debug audio quality issues
- ✅ Tune parameters before integrating into boat
- ✅ Work on your desk with just ESP32 + amp + speaker

## Prerequisites

1. **Generate PCM audio data** (if not already done):
   ```bash
   cd ../../audio-assets/engine
   ./convert_engine_audio.sh
   cp engine_pcm.h ../boat_telemetry/
   ```

2. **Hardware setup**:
   - ESP32 Dev Board
   - MAX98357A I2S amplifier
   - 4-8Ω speaker (or headphones via 3.5mm jack)
   - Connections:
     ```
     ESP32 GPIO25 → MAX98357A BCLK
     ESP32 GPIO22 → MAX98357A LRC (or LRCLK/WS)
     ESP32 GPIO23 → MAX98357A DIN
     ESP32 5V     → MAX98357A VIN
     ESP32 GND    → MAX98357A GND
     ```

## How to Use

### 1. Upload the Sketch

Open `audio_diagnostic.ino` in Arduino IDE and upload to ESP32.

### 2. Open Serial Monitor

- Set baud rate to **115200**
- You should see initialization messages

### 3. Test Commands

Send single characters via serial monitor:

#### Basic Throttle Control
- **`0`** - Idle (0% throttle)
- **`5`** - Half throttle (50%)
- **`9`** - Full throttle (100%)
- **`1-8`** - Other throttle levels

#### Automated Tests
- **`a`** - Auto sweep mode (smooth 0-100% loop, 5sec cycle)
- **`r`** - Rev test (snap from 0% to 80%, tests transient)
- **`s`** - Stop/return to idle

#### Status/Help
- **`i`** - Print current status (throttle, rate, gain, memory)
- **`h`** or **`?`** - Show help

### 4. What You Should Hear

- **Idle (`0`)**: Quiet, low-pitched engine rumble
- **Half (`5`)**: Medium pitch and volume
- **Full (`9`)**: Louder, higher-pitched (but not chipmunk!)
- **Auto sweep (`a`)**: Smooth transition up and down
- **Rev (`r`)**: Quick burst of pitch+volume, then decay

### 5. Expected Serial Output

```
========================================
  ENGINE AUDIO DIAGNOSTIC TEST
========================================

[1/3] Initializing I2S for MAX98357A...
  ✓ I2S initialized
    Sample rate: 22050 Hz
    Pins: BCLK=25, LRC=22, DIN=23
[2/3] Initializing audio engine...
Audio engine initialized
  PCM samples: 24000 (1.09s @ 22050 Hz)
  Rate range: 0.80 - 1.50
  Gain range: 0.40 - 1.00
[3/3] Starting audio task on Core 1...
  ✓ Audio task created (Core 1, priority 5)

========================================
  DIAGNOSTIC READY
========================================

COMMANDS:
  0-9  Set throttle (0=idle, 9=full throttle)
  a    Toggle auto sweep mode (slow ramp)
  r    Rev test (snap throttle)
  s    Stop/idle
  i    Print current status
  h/?  Show this help
```

## Troubleshooting

### No sound at all
1. Check wiring (especially GND connection)
2. Verify MAX98357A has power LED lit
3. Check speaker polarity (try swapping + and -)
4. Verify `engine_pcm.h` exists in `boat_telemetry/` folder
5. Check serial output for I2S errors

### Crackling/distortion
- Loose wires (especially ground)
- Speaker impedance too low (use 4-8Ω)
- Power supply issue (use good USB cable)

### Wrong pitch/strange sound
- Audio file might be corrupt
- Try regenerating `engine_pcm.h`
- Check sample rate matches (22050 Hz)

### "Audio engine initialized" but PCM samples = 0
- `engine_pcm.h` is missing or empty
- Run the conversion script first

### ESP32 crashes/reboots
- Check heap memory in status (`i` command)
- If free heap < 50KB, audio file might be too large
- Reduce audio file length

## Tuning Parameters

Once audio is working, you can adjust feel in `audio_engine.h`:

```cpp
#define THROTTLE_SMOOTH_ALPHA   0.15f   // Smoothing (lower=slower)
#define RATE_MIN                0.8f    // Idle pitch
#define RATE_MAX                1.5f    // Full throttle pitch
#define GAIN_MIN                0.4f    // Idle volume
#define GAIN_MAX                1.0f    // Full throttle volume
#define REV_BOOST_RATE          1.1f    // Rev pitch multiplier
#define REV_BOOST_GAIN          1.2f    // Rev volume multiplier
```

Changes require recompiling both this diagnostic **and** the main firmware.

## Next Steps

Once you verify audio works with this diagnostic:
1. Close this sketch
2. Flash `boat_telemetry.ino` (main firmware)
3. Connect RC receiver to GPIO18
4. Test with real throttle input
5. Use `/engine-debug` endpoint to tune in realtime

## Hardware Notes

**MAX98357A variants:**
- Some boards have LRC labeled as "LRCLK" or "WS" - same pin
- Some have GAIN pins - leave them floating for default gain
- SD (shutdown) pin - leave floating or tie HIGH

**Power:**
- MAX98357A can draw 2-3W at full volume
- Use good quality USB cable (thin cables = voltage drop)
- If ESP32 browns out, add 470µF capacitor across VIN/GND
