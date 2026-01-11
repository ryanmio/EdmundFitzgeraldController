# Quick Start - Audio Implementation

**Goal**: Get audio files recorded and system working in minimal time.

---

## 1. THE THREE TRANSMISSIONS

Record yourself reading these three lines:

### Radio 1
**"We are holding our own"**

### Radio 2
**"I have a fence rail down, two vents lost or damaged"**

### Radio 3
**"Anderson, this is the Fitzgerald. I have lost both radars"**

---

## 2. RECORDING SETUP (5 minutes)

**Equipment needed**:
- Any microphone (USB mic, phone, laptop built-in)
- Quiet room
- Free software: [Audacity](https://www.audacityteam.org/)

**Voice tips**:
- Deep, calm captain's voice
- Professional, composed tone
- Speak clearly but not rushed
- Imagine you're on a radio in a storm

---

## 3. AUDACITY QUICK PROCESS (10 minutes per file)

### Record
1. Open Audacity
2. Click red **Record** button
3. Read the transmission clearly
4. Click **Stop** (square button)
5. Do 3-5 takes

### Edit
1. **Select** best take (click and drag on waveform)
2. **Effect** → **Equalization** → Select "Telephone" preset → OK
3. **Effect** → **Compressor** → Use defaults → OK
4. **Select** the audio → Trim to 2-3 seconds (delete extra)
5. **Effect** → **Normalize** → Set to -3dB → OK

### Optional Radio Static
1. **Generate** → **Noise** → White Noise → 2.5 seconds → OK
2. **Lower volume** of noise to -40dB (use gain slider on track)
3. **Tracks** → **Mix and Render**

### Export
1. **File** → **Export** → **Export as WAV**
2. Settings:
   - WAV (Microsoft)
   - Signed 16-bit PCM
   - 22050 Hz
   - Mono
3. Save as:
   - `radio1.wav`
   - `radio2.wav`
   - `radio3.wav`

---

## 4. HARDWARE SHOPPING LIST

Order these components:

| Item | Quantity | Est. Cost | Where to Buy |
|------|----------|-----------|--------------|
| MAX98357A I2S Amp Module | 1 | $7 | Amazon, Adafruit |
| MicroSD Card Module | 1 | $3 | Amazon, eBay |
| MicroSD Card (4-16GB) | 1 | $7 | Amazon, Best Buy |
| Jumper Wires (M-F) | 10-15 | $3 | Amazon |
| **Total** | | **~$20** | |

**Amazon search terms**:
- "MAX98357A I2S amplifier"
- "MicroSD card module Arduino"
- "8GB microSD card FAT32"

---

## 5. PREPARE SD CARD (2 minutes)

1. **Format** SD card as FAT32
   - Windows: Right-click drive → Format → FAT32
   - Mac: Disk Utility → Erase → MS-DOS (FAT)
2. **Create folder** named `audio` on SD card root
3. **Copy files** into `/audio/` folder:
   - `radio1.wav`
   - `radio2.wav`
   - `radio3.wav`
4. **Eject** SD card safely

---

## 6. HARDWARE WIRING (15 minutes)

**IMPORTANT**: Power off ESP32 first!

### MAX98357A Connections
```
MAX98357A          ESP32
---------------------------------
VIN          →     5V (from BEC)
GND          →     GND
LRC          →     GPIO25
BCLK         →     GPIO26
DIN          →     GPIO22

Speaker      →     + and - terminals
```

### MicroSD Module Connections
```
MicroSD Module     ESP32
---------------------------------
VCC          →     5V
GND          →     GND
CS           →     GPIO5
MOSI         →     GPIO23
MISO         →     GPIO19*
SCK          →     GPIO18*
```

**\*Note**: GPIO18 and GPIO19 conflict with RC receiver pins. **Move RC receiver to GPIO13 and GPIO14** (update in firmware).

### Insert SD Card
- Insert your prepared microSD card into the module

---

## 7. FIRMWARE UPDATE (10 minutes)

### Install Library
1. Open Arduino IDE
2. **Tools** → **Manage Libraries**
3. Search "ESP32-audioI2S"
4. Install "ESP32-audioI2S" by schreibfaul1

### Update Pin Definitions
Open `boat_telemetry.ino` and add:

```cpp
// Add after existing pin definitions (around line 20)
#define I2S_DOUT      22
#define I2S_BCLK      26
#define I2S_LRC       25
#define SD_CS         5
```

Change these lines:
```cpp
// OLD:
#define THROTTLE_PWM_PIN  18
#define SERVO_PWM_PIN     19

// NEW:
#define THROTTLE_PWM_PIN  13
#define SERVO_PWM_PIN     14
```

### Add Audio Code
See `/docs/AUDIO_IMPLEMENTATION.md` for complete code, or download the updated firmware from the repository.

### Upload
1. Connect ESP32 via USB
2. **Sketch** → **Upload**
3. Wait for upload complete

---

## 8. TESTING (5 minutes)

1. **Open Serial Monitor** (115200 baud)
2. Look for messages:
   - "SD Card initialized successfully"
   - "Audio system initialized"
3. **Open mobile app**
4. **Test buttons**:
   - Press **Horn** → Should hear horn (or placeholder tone if no `horn.wav`)
   - Press **SOS** → Should hear SOS (or Morse code if no `sos.wav`)
   - Press **Radio 1** → Should hear "We are holding our own"
   - Press **Radio 2** → Should hear "I have a fence rail down..."
   - Press **Radio 3** → Should hear "Anderson, this is the Fitzgerald..."

### Success Criteria
- ✅ All three radio transmissions play clearly
- ✅ Radio sounds are quieter than horn/SOS would be
- ✅ No stuttering or distortion
- ✅ Button holds repeat correctly

---

## TROUBLESHOOTING

### "SD Card Mount Failed!" in Serial Monitor
- Check wiring (especially CS, MOSI, MISO, SCK)
- Check SD card is FAT32 formatted
- Try different SD card
- Check SD module has power (5V or 3.3V depending on module)

### No audio output
- Check speaker connected to MAX98357A (not PAM8403)
- Check I2S wiring (DIN, BCLK, LRC)
- Check MAX98357A has 5V power
- Check Serial Monitor for "Playing: /audio/radioX.wav" messages

### Audio plays but garbled/distorted
- Check WAV files are 22050 Hz, 16-bit, mono
- Check power supply has enough current
- Lower volume in firmware code

### Files not found
- Check folder is named exactly `/audio/` on SD card
- Check files named exactly `radio1.wav`, `radio2.wav`, `radio3.wav`
- Check SD card inserted correctly

---

## COMPLETE DOCUMENTATION

For detailed technical information:

- **Complete technical guide**: `/docs/AUDIO_IMPLEMENTATION.md`
- **Recording guide**: `RECORDING_GUIDE.md` (this folder)
- **Audio system overview**: `README.md` (this folder)
- **Hardware integration**: `/docs/INTEGRATION_GUIDE.md`

---

## TIMELINE ESTIMATE

| Phase | Time | Can Do Now? |
|-------|------|-------------|
| Record audio files | 30 min | ✅ Yes |
| Edit in Audacity | 30 min | ✅ Yes |
| Order hardware | 5 min | ✅ Yes |
| Wait for shipping | 3-7 days | ⏰ Wait |
| Wire hardware | 15 min | ⏸️ After hardware arrives |
| Update firmware | 10 min | ⏸️ After hardware arrives |
| Test system | 5 min | ⏸️ After firmware upload |
| **Total active time** | **~90 min** | |

**You can start recording today!** No hardware needed for that step.

---

## WHAT IF I DON'T WANT TO RECORD?

### Alternative 1: Text-to-Speech
- Use Google Cloud TTS or Amazon Polly
- Select deep male voice (e.g., "Matthew")
- Generate speech files
- Apply radio effect in Audacity

### Alternative 2: Hire Voice Actor
- Fiverr.com or Voices.com
- Budget: $20-50 for three short clips
- Provide the three scripts

### Alternative 3: Use Current PWM System
- Keep using tone-based audio (already works)
- No additional hardware needed
- Just wire PAM8403 amp + speaker per Phase 6 of Integration Guide

---

## NEXT STEPS

**Today**:
1. ✅ Read this guide
2. ✅ Download Audacity
3. ✅ Record the three transmissions
4. ✅ Edit and export WAV files
5. ✅ Order hardware (MAX98357A, SD module, SD card)

**When hardware arrives**:
1. ✅ Prepare SD card with audio files
2. ✅ Wire MAX98357A and SD module
3. ✅ Update firmware
4. ✅ Test and enjoy!

---

**Good luck! You're about to give your boat an authentic voice from maritime history. 🚢**
