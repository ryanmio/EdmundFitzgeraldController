#!/bin/bash
# Convert engine.mp3 to loopable PCM WAV with proper crossfade
# Dependencies: ffmpeg, python3, pydub

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Engine Audio Conversion Pipeline ==="
echo ""

# Check dependencies
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg not found. Install with: brew install ffmpeg"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found."
    exit 1
fi

# Check for pydub
if ! python3 -c "import pydub" 2>/dev/null; then
    echo "ERROR: pydub not found. Install with: pip3 install pydub"
    exit 1
fi

echo "[1/4] Converting engine.mp3 to mono 16-bit PCM WAV at 22050 Hz..."
ffmpeg -i engine.mp3 -ar 22050 -ac 1 -c:a pcm_s16le temp.wav -y -loglevel warning

echo "[2/4] Applying 50ms loop crossfade..."
python3 << 'EOF'
from pydub import AudioSegment
import sys

try:
    audio = AudioSegment.from_wav("temp.wav")
    crossfade_ms = 50
    
    # Extract end and start segments
    end_segment = audio[-crossfade_ms:]
    start_segment = audio[:crossfade_ms]
    
    # Overlay end onto start with fade to create seamless loop
    crossfaded_start = start_segment.overlay(end_segment.fade_in(crossfade_ms), position=0)
    
    # Replace start with crossfaded version
    result = crossfaded_start + audio[crossfade_ms:]
    
    result.export("engine_loop.wav", format="wav")
    print(f"  ✓ Created engine_loop.wav ({len(result)/1000:.2f}s, {len(result.raw_data)} bytes)")
except Exception as e:
    print(f"ERROR: Crossfade failed: {e}", file=sys.stderr)
    sys.exit(1)
EOF

echo "[3/4] Generating C header file with PCM data array..."
python3 generate_pcm_header.py engine_loop.wav engine_pcm.h

echo "[4/4] Cleaning up temporary files..."
rm -f temp.wav

echo ""
echo "=== Conversion Complete ==="
echo "  Output: engine_loop.wav"
echo "  Header: engine_pcm.h"
echo ""
echo "Next steps:"
echo "  1. Review engine_loop.wav in an audio editor"
echo "  2. Copy engine_pcm.h to firmware/boat_telemetry/"
echo "  3. Build and flash firmware"
