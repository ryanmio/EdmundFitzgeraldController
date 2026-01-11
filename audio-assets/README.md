# Audio Assets for Edmund Fitzgerald Controller

This folder contains audio files for the boat telemetry system's sound effects.

## Audio System Overview

**Current Implementation (v1.3.0)**: PWM-based tone generation
**Target Implementation (v2.0)**: I2S DAC + amplifier with WAV file playback

See `/docs/AUDIO_IMPLEMENTATION.md` for complete implementation guide.

---

## Audio Files Needed

### Historical Radio Transmissions (Primary)

| File | Description | Content | Duration | Status |
|------|-------------|---------|----------|--------|
| `radio1.wav` | Final transmission | "We are holding our own" | 2.5s | ⏳ **Recording needed** |
| `radio2.wav` | Damage report | "I have a fence rail down, two vents lost or damaged" | 2.5s | ⏳ **Recording needed** |
| `radio3.wav` | Systems failure | "Anderson, this is the Fitzgerald. I have lost both radars" | 2.5s | ⏳ **Recording needed** |

### Optional Sound Effects

| File | Description | Content | Duration | Status |
|------|-------------|---------|----------|--------|
| `horn.wav` | Boat horn blast | Deep horn sound | 2.0s | ⏸️ Optional |
| `sos.wav` | SOS distress | Morse code SOS sequence | 6.0s | ⏸️ Optional |

---

## Recording Instructions

**See `RECORDING_GUIDE.md` in this folder for detailed instructions on:**
- How to record your voice reading the three transmissions
- Audio post-production steps (Audacity radio effect)
- File format specifications
- Quality checklist

**Quick Start**:
1. Read `RECORDING_GUIDE.md` for full instructions
2. Record yourself reading the three radio transmissions
3. Edit in Audacity (apply radio effect, trim to 2.5s)
4. Export as WAV (22050 Hz, 16-bit, mono)
5. Copy files to microSD card in `/audio/` folder

---

## File Specifications

### Technical Requirements
- **Format**: WAV (uncompressed)
- **Sample Rate**: 22050 Hz
- **Bit Depth**: 16-bit PCM
- **Channels**: Mono (single channel)
- **Duration**: 2.0-2.5 seconds (radio transmissions)
- **File Size**: ~90-100 KB per file

### Audio Quality Guidelines
- **Voice**: Deep, professional captain's voice (50s-60s)
- **Tone**: Calm, authoritative, experienced mariner
- **Effect**: Radio transmission with light static
- **Clarity**: Must be clearly understandable despite effects
- **Volume**: Normalized to -3dB peak (firmware controls playback volume)

---

## Storage Structure

### MicroSD Card Layout
```
/audio/
  ├── radio1.wav   (We are holding our own)
  ├── radio2.wav   (Fence rail down, vents lost)
  ├── radio3.wav   (Lost both radars)
  ├── horn.wav     (Optional - boat horn)
  └── sos.wav      (Optional - Morse SOS)
```

### SD Card Requirements
- **Capacity**: 4GB minimum (32GB maximum for compatibility)
- **Format**: FAT32
- **Speed**: Class 4 or higher (Class 10 recommended)

---

## Firmware Integration

### API Endpoints (Existing)
The firmware already has endpoints for audio playback:

- `POST /horn` → Plays horn sound (currently PWM tone, will play `horn.wav`)
- `POST /sos` → Plays SOS signal (currently PWM morse, will play `sos.wav`)
- `POST /radio` with `{"radio_id": 1}` → Plays `radio1.wav`
- `POST /radio` with `{"radio_id": 2}` → Plays `radio2.wav`
- `POST /radio` with `{"radio_id": 3}` → Plays `radio3.wav`

**No app changes needed** - the mobile app already triggers these endpoints correctly.

### Volume Levels (Firmware-Controlled)
| Sound | Volume | Use Case |
|-------|--------|----------|
| Horn | 100% | Emergency alarm (LOUD) |
| SOS | 78% | Distress signal (LOUD) |
| Radio 1/2/3 | 47% | Background transmissions (MODERATE) |

---

## Adding New Sound Effects

To add new audio files in the future:

1. **Create audio file**:
   - Record or source audio
   - Edit to desired length
   - Export as WAV (22050 Hz, 16-bit, mono)

2. **Add to SD card**:
   - Copy file to `/audio/` folder
   - Use descriptive filename (e.g., `engine-start.wav`)

3. **Update firmware** (if new endpoint needed):
   - Add new handler function
   - Register endpoint in `setup()`
   - Add `playAudioFile()` call with appropriate volume

4. **Update mobile app** (if new button needed):
   - Add button to appropriate screen
   - Wire up to call new endpoint

---

## Resources

- **Recording Guide**: See `RECORDING_GUIDE.md` in this folder
- **Implementation Guide**: See `/docs/AUDIO_IMPLEMENTATION.md`
- **Integration Guide**: See `/docs/INTEGRATION_GUIDE.md`
- **Firmware**: See `/firmware/boat_telemetry/boat_telemetry.ino`

---

## Historical Note

The three radio transmissions are authentic quotes from the final voyage of the SS Edmund Fitzgerald, which sank on November 10, 1975, with all 29 crew members lost. These recordings honor their memory and the maritime tradition of the Great Lakes.

**In Memory**: Captain Ernest M. McSorley and the 28 crew members of the SS Edmund Fitzgerald.

---

## Status and Next Steps

### Current Status
- ✅ Firmware v1.3.0 has PWM-based audio (horn, SOS, radio endpoints)
- ✅ Mobile app has working buttons and debouncing
- ⏳ **Need to record audio files** (see `RECORDING_GUIDE.md`)
- ⏳ **Need to implement I2S audio system** (see `/docs/AUDIO_IMPLEMENTATION.md`)
- ⏳ **Need to order hardware** (MAX98357A amp, microSD module)

### Quick Start Path
1. **Read** `/docs/AUDIO_IMPLEMENTATION.md` (complete technical guide)
2. **Read** `RECORDING_GUIDE.md` (recording instructions)
3. **Record** the three radio transmissions (your voice)
4. **Order** MAX98357A and microSD card module
5. **Wait** for hardware to arrive
6. **Follow** implementation guide to wire and program

---

**Questions?** See the documentation guides or check the firmware source code for details.
