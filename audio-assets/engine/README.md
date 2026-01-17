# Engine Audio Assets

This directory contains the source engine audio file and conversion pipeline for generating loopable PCM data for the ESP32 I2S audio system.

## Files

- **engine.mp3** - Source engine audio recording
- **convert_simple.sh** - Conversion pipeline script
- **generate_pcm_header.py** - PCM-to-C-header generator
- **engine_loop.wav** - Generated loopable WAV (after running script)
- **engine_pcm.h** - Generated C header for firmware (after running script)

## Dependencies

### macOS
```bash
# Install ffmpeg
brew install ffmpeg
```

### Linux (Debian/Ubuntu)
```bash
# Install ffmpeg
sudo apt-get install ffmpeg
```

## Usage

Run the conversion pipeline:

```bash
cd audio-assets/engine
./convert_simple.sh
```

This will:
1. Convert `engine.mp3` to mono 16-bit PCM WAV at 44100 Hz
2. Apply 8kHz low-pass anti-aliasing filter to prevent pitch-shift artifacts
3. Generate `engine_loop.wav` (processed audio)
4. Generate `engine_pcm.h` (C header with PCM data array)

## Integration

After running the script:

1. **Review the audio**: Open `engine_loop.wav` in an audio editor
2. **Copy to firmware**: 
   ```bash
   cp engine_pcm.h ../../firmware/boat_telemetry/
   cp engine_pcm.h ../../firmware/audio_diagnostic/
   ```
3. **Build firmware**: The `engine_pcm.h` header will be included automatically

## Technical Details

- **Sample rate**: 44100 Hz (higher rate prevents aliasing when pitch-shifting up to 1.5x)
- **Format**: Mono 16-bit signed PCM
- **Anti-aliasing**: 8kHz low-pass filter applied to prevent high-frequency noise during pitch shifts
- **Size**: ~88 KB per second of audio (44100 samples × 2 bytes)

## Troubleshooting

**"ffmpeg not found"**
- Install ffmpeg using the commands above

**"generate_pcm_header.py failed"**
- Ensure Python 3 is installed: `python3 --version`
- The script only uses built-in Python modules (no pip dependencies)

**"Conversion failed"**
- Check that `engine.mp3` exists and is a valid audio file
- Verify ffmpeg can read the file: `ffmpeg -i engine.mp3`

**Generated header is huge**
- Longer audio = larger header file
- Current file is ~379 KB for 4.4 seconds at 44.1kHz
- The ESP32 has 4MB flash, so this is acceptable
- Consider trimming `engine.mp3` if file size becomes an issue
