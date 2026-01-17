#!/bin/bash
# Simplified audio conversion using ffmpeg only, no pydub

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Engine Audio Conversion (Simplified) ==="
echo ""

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg not found. Install with: brew install ffmpeg"
    exit 1
fi

echo "[1/2] Converting engine.mp3 to mono 16-bit PCM WAV at 22050 Hz..."
ffmpeg -i engine.mp3 -ar 22050 -ac 1 -c:a pcm_s16le engine_loop.wav -y -loglevel warning

echo "[2/2] Generating C header file with PCM data array..."
python3 generate_pcm_header.py engine_loop.wav engine_pcm.h

echo ""
echo "=== Conversion Complete ==="
echo "  Output: engine_loop.wav"
echo "  Header: engine_pcm.h"
echo ""
echo "Next steps:"
echo "  1. Review engine_loop.wav in an audio editor"
echo "  2. Copy engine_pcm.h to firmware folders:"
echo "     cp engine_pcm.h ../boat_telemetry/"
echo "     cp engine_pcm.h ../audio_diagnostic/"
echo "  3. Build and flash firmware"
