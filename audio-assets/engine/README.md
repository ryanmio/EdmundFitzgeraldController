# Engine Audio Assets

This directory contains the source engine audio file and conversion pipeline for generating loopable PCM data for the ESP32 I2S audio system.

## Files

- **engine.mp3** - Source engine audio recording
- **convert_engine_audio.sh** - Conversion pipeline script
- **generate_pcm_header.py** - PCM-to-C-header generator
- **engine_loop.wav** - Generated loopable WAV (after running script)
- **engine_pcm.h** - Generated C header for firmware (after running script)

## Dependencies

### macOS
```bash
# Install ffmpeg
brew install ffmpeg

# Install Python dependencies
pip3 install pydub
```

### Linux (Debian/Ubuntu)
```bash
# Install ffmpeg
sudo apt-get install ffmpeg

# Install Python dependencies
pip3 install pydub
```

## Usage

Run the conversion pipeline:

```bash
cd audio-assets/engine
./convert_engine_audio.sh
```

This will:
1. Convert `engine.mp3` to mono 16-bit PCM WAV at 22050 Hz
2. Apply a 50ms crossfade at the loop boundary to eliminate clicks
3. Generate `engine_loop.wav` (loopable audio)
4. Generate `engine_pcm.h` (C header with PCM data array)

## Integration

After running the script:

1. **Review the audio**: Open `engine_loop.wav` in an audio editor and verify the loop is seamless
2. **Copy to firmware**: 
   ```bash
   cp engine_pcm.h ../../firmware/boat_telemetry/
   ```
3. **Build firmware**: The `engine_pcm.h` header will be included automatically

## Technical Details

- **Sample rate**: 22050 Hz (chosen for balance between quality and CPU load)
- **Format**: Mono 16-bit signed PCM
- **Crossfade**: 50ms end-to-start overlay with fade-in to prevent loop clicks
- **Size**: ~22 KB per second of audio (22050 samples × 2 bytes)

## Troubleshooting

**"ffmpeg not found"**
- Install ffmpeg using the commands above

**"pydub not found"**
- Run: `pip3 install pydub`

**"Crossfade failed"**
- Check that `engine.mp3` exists and is a valid audio file
- Verify ffmpeg can read the file: `ffmpeg -i engine.mp3`

**Generated header is huge**
- Longer audio = larger header file
- Consider trimming `engine.mp3` to 2-3 seconds for a tight loop
- The ESP32 has 4MB flash, but keep headers under 100KB for safety
