# Edmund Fitzgerald Controller - Audio Recording Guide

**Purpose**: Instructions for recording the three historical radio transmissions from the Edmund Fitzgerald's final voyage.

---

## The Three Radio Transmissions

### Radio 1: "We are holding our own"
**Transcript**: *"We are holding our own"*

- **Historical Context**: Captain Ernest McSorley's last transmission to Captain Jesse Cooper of the Arthur M. Anderson, spoken approximately 10 minutes before the Edmund Fitzgerald sank
- **Time of Day**: ~7:10 PM, November 10, 1975
- **Situation**: The ship was in severe distress, taking on water, with damaged radar and vents
- **Tone**: Calm, professional, reassuring despite dire circumstances
- **Why Iconic**: These were the last words ever heard from the Edmund Fitzgerald

**Recording Instructions**:
- Read slowly and deliberately
- Deep, calm, slightly tired voice
- Professional captain's tone - confident but not cheerful
- Slight static/radio effect in post-production
- Duration: 2.5 seconds

---

### Radio 2: "I have a fence rail down, two vents lost or damaged"
**Transcript**: *"I have a fence rail down, two vents lost or damaged"*

- **Historical Context**: Damage report from Captain McSorley to the Arthur M. Anderson during the height of the storm
- **Time of Day**: ~3:30 PM, November 10, 1975
- **Situation**: Ship taking heavy waves, losing topside equipment
- **Tone**: Matter-of-fact, professional damage report, growing concern
- **Why Significant**: First indication that the ship was sustaining serious structural damage

**Recording Instructions**:
- Methodical, professional reporting tone
- Slight urgency but maintaining composure
- Read as a status report to another vessel
- Radio static effect in post-production
- Duration: 2.5 seconds

---

### Radio 3: "Anderson, this is the Fitzgerald. I have lost both radars"
**Transcript**: *"Anderson, this is the Fitzgerald. I have lost both radars"*

- **Historical Context**: Critical systems failure report to the Arthur M. Anderson
- **Time of Day**: ~5:20 PM, November 10, 1975
- **Situation**: Ship's navigation systems failing in a severe storm on Lake Superior
- **Tone**: Serious, concerning, composed but clearly troubled
- **Why Significant**: Losing radar in a storm meant the Fitzgerald was essentially blind

**Recording Instructions**:
- Formal radio protocol (call sign usage)
- Serious tone, indicating critical equipment failure
- Professional but with underlying concern
- Radio static effect in post-production
- Duration: 2.5 seconds

---

## Voice Recording Guidelines

### Voice Characteristics
- **Age**: 50s-60s (Captain McSorley was 63)
- **Tone**: Deep, authoritative, experienced captain
- **Accent**: Great Lakes region, neutral American English
- **Emotion**: Professional composure with underlying stress
- **Energy**: Tired but focused (they'd been in the storm for hours)

### Recording Environment
- **Location**: Quiet room, no background noise
- **Microphone**: Any decent USB microphone or smartphone
- **Distance**: 6-12 inches from microphone
- **Room**: Avoid echo (use closet or room with soft furnishings)

### Recording Tips
1. **Warm up your voice** - Read the lines several times before recording
2. **Record multiple takes** - Do 5-10 takes of each transmission
3. **Vary delivery slightly** - Try different emotional tones
4. **Record raw first** - Don't add effects during recording
5. **Stay consistent** - Use same microphone/room for all three

---

## Audio Post-Production (Audacity)

### Step-by-Step Radio Effect Recipe

#### 1. Import and Clean
1. **Import** your raw recording into Audacity
2. **Select** the best take (clear, good tone, right duration)
3. **Trim** to exactly 2.0-2.5 seconds
4. **Normalize** to -3dB (Effect → Normalize → Peak -3dB)

#### 2. Apply Radio Effect
1. **Effect → Equalization** (or Filter Curve EQ)
   - Select "Telephone" or "Radio" preset
   - This cuts low frequencies (<300 Hz) and high frequencies (>3000 Hz)
   - Mimics radio transmission bandwidth limitations
   - Adjust curve if needed to sound authentic

2. **Effect → Compressor**
   - Threshold: -12dB
   - Ratio: 3:1
   - Attack: 0.2s
   - Release: 1.0s
   - This evens out volume, makes voice punchy

3. **Generate → Noise → Add Radio Static** (manual method):
   - Generate → Noise → White Noise (0.5 second)
   - Lower volume to -40dB
   - Mix with voice track (Tracks → Mix → Mix and Render)
   - Optional: Add light crackle/pop sounds

#### 3. Final Polish
1. **Fade In/Fade Out** (very quick, 0.1s each)
   - Prevents clicks at start/end
   - Select first 0.1s → Effect → Fade In
   - Select last 0.1s → Effect → Fade Out

2. **Normalize Again** to -3dB peak

3. **Listen Critically**:
   - Does it sound like a radio transmission?
   - Is the voice clear enough to understand?
   - Is the static level appropriate? (not too loud)

#### 4. Export
- **File → Export → Export as WAV**
- **Settings**:
  - Format: WAV (Microsoft)
  - Encoding: Signed 16-bit PCM
  - Sample Rate: 22050 Hz
  - Channels: Mono
- **Save as**:
  - `radio1.wav` - "We are holding our own"
  - `radio2.wav` - "I have a fence rail down..."
  - `radio3.wav` - "Anderson, this is the Fitzgerald..."

---

## Advanced Radio Effect (Optional)

For a more authentic 1970s marine radio sound:

### Two-Way Radio Characteristics
1. **Squelch Break** (start of transmission)
   - Brief burst of static/noise (0.1s)
   - Generate → Tone → 2000 Hz, 0.05s duration, amplitude 0.3
   - Place at very start

2. **VHF Marine Radio Frequency Response**
   - Bandpass filter: 300 Hz to 2700 Hz
   - Effect → Filter Curve EQ
   - Boost slight peak around 1200 Hz (voice clarity)

3. **Background Noise**
   - Storm interference: low rumble + static
   - Generate → Pink Noise (not white) for more realistic radio noise
   - Mix at -45dB to -50dB

4. **Click/Release at End**
   - Microphone release sound (0.05s)
   - Generate → Click Track → Single click
   - Place at very end, lower volume

### Reference Recordings
Listen to actual 1970s marine radio recordings on YouTube:
- Search: "VHF marine radio 1970s"
- Search: "ship to ship radio communication vintage"
- Study the tone, static level, and frequency response

---

## File Organization

### Directory Structure on MicroSD Card
```
/audio/
  ├── radio1.wav   (We are holding our own)
  ├── radio2.wav   (Fence rail down)
  ├── radio3.wav   (Lost both radars)
  ├── horn.wav     (Optional - boat horn sound)
  └── sos.wav      (Optional - Morse SOS recording)
```

### File Specifications Summary
| Parameter | Value | Notes |
|-----------|-------|-------|
| Format | WAV | Uncompressed audio |
| Sample Rate | 22050 Hz | Good quality, manageable size |
| Bit Depth | 16-bit | Standard CD quality |
| Channels | Mono | Single channel |
| Duration | 2.0-2.5 sec | Firmware expects ~2.5s |
| File Size | ~90-100 KB | Per file |

---

## Quality Checklist

Before finalizing recordings, verify:

- [ ] All three files are 2.0-2.5 seconds long
- [ ] Voice is clear and understandable despite radio effect
- [ ] Radio static/noise is present but not overwhelming
- [ ] All three transmissions are clearly distinct from each other
- [ ] Volume levels are consistent across all three files
- [ ] No clipping or distortion (check waveform)
- [ ] No unwanted background noise (breathing, clicks, etc.)
- [ ] Files are exported as 22050 Hz, 16-bit, mono WAV
- [ ] File names match exactly: `radio1.wav`, `radio2.wav`, `radio3.wav`
- [ ] Files are saved to `/audio/` folder on SD card

---

## Alternative: Find Existing Recordings

If you prefer not to record yourself:

### Option 1: Use Text-to-Speech (TTS)
- **Google Cloud TTS** or **Amazon Polly**
- Select deep male voice (e.g., "Matthew" on Polly)
- Generate speech, then apply radio effects in Audacity
- Advantages: Professional, consistent quality
- Disadvantages: May sound robotic, less authentic

### Option 2: Hire Voice Actor
- **Fiverr** or **Voices.com**
- Request: "Deep male voice, 1970s ship captain, radio transmission effect"
- Provide the three scripts
- Budget: $20-50 for three short clips
- Advantages: Professional quality, authentic emotion
- Disadvantages: Cost, turnaround time

### Option 3: Use Royalty-Free Samples
- **Freesound.org** or **Archive.org**
- Search for vintage radio transmissions
- Edit/remix to fit your needs
- **Important**: Check license (Creative Commons, public domain)

---

## Testing Your Recordings

### Before Installing on Boat
1. **Play on computer** - Do they sound good on speakers?
2. **Play on phone** - Do they sound good on mobile device?
3. **Test volume** - Can you clearly distinguish between samples?

### After Installing on ESP32
1. **Test playback** - Do files play without errors?
2. **Test volume levels** - Are radios quieter than horn/SOS?
3. **Test distinctiveness** - Can you tell them apart without looking?
4. **Test repeats** - Do they handle button holds correctly?

---

## Example Script Template

Here's a practice script to help you get into character:

```
[You are Captain Ernest McSorley, master of the SS Edmund Fitzgerald.
 It's November 10, 1975, late afternoon/evening.
 You've been battling a severe storm on Lake Superior for hours.
 Your ship is taking damage, systems are failing, but you maintain composure.
 You're speaking over VHF marine radio to the Arthur M. Anderson.]

RADIO 1:
*[Tired but calm, matter-of-fact, professional]* 
"We are holding our own."

RADIO 2:
*[Methodical damage report, slight concern but composed]*
"I have a fence rail down, two vents lost or damaged."

RADIO 3:
*[Formal radio protocol, serious, critical situation]*
"Anderson, this is the Fitzgerald. I have lost both radars."
```

---

## Resources

### Audio Editing Software
- **Audacity** (Free): https://www.audacityteam.org/
- **GarageBand** (Mac, Free): Pre-installed on macOS
- **Adobe Audition** (Professional, Paid): https://www.adobe.com/products/audition.html

### Historical References
- **Great Lakes Shipwreck Museum**: https://www.shipwreckmuseum.com/edmund-fitzgerald/
- **NTSB Report**: Search "Edmund Fitzgerald NTSB 1975"
- **Gordon Lightfoot Song**: "The Wreck of the Edmund Fitzgerald" (1976)

### Recording Tutorials
- YouTube: "How to record voice for projects"
- YouTube: "Audacity radio effect tutorial"
- YouTube: "Vintage radio sound effect"

---

## Credits and Respect

The Edmund Fitzgerald sank on November 10, 1975, with all 29 crew members lost. This project honors their memory by recreating authentic radio communications from that tragic final voyage.

**In Memory Of**:
- Captain Ernest M. McSorley and the 28 crew members of the SS Edmund Fitzgerald
- "The lake, it is said, never gives up her dead when the skies of November turn gloomy"

When you record these transmissions, remember you're honoring the voices of mariners who gave their lives to the Great Lakes. Treat these recordings with respect and authenticity.

---

**End of Recording Guide**
