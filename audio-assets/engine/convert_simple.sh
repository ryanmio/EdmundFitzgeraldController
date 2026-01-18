#!/bin/bash
# Engine Audio Conversion - FFT circular filtering version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Engine Audio Conversion (FFT Circular) ==="
echo ""

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg not found. Install with: brew install ffmpeg"
    exit 1
fi

echo "[1/3] Converting engine.mp3 to raw WAV (22050 Hz for flash space)..."
ffmpeg -y -i engine.mp3 -ac 1 -ar 22050 -c:a pcm_s16le engine_raw_temp.wav -y -loglevel warning

echo "[2/3] Applying FFT-domain circular High-Pass Filter (300Hz)..."
# Using the new Python script for zero-phase circular filtering
python3 make_engine_filtered_fft.py engine_raw_temp.wav engine_loop.wav

echo "[3/3] Generating C headers..."
python3 generate_pcm_header.py engine_loop.wav engine_pcm.h
python3 generate_pcm_header_raw.py engine_raw_temp.wav engine_pcm_raw.h

# Cleanup
rm -f engine_raw_temp.wav

echo ""
echo "=== Conversion Complete ==="
echo "Filtered PCM: engine_pcm.h"
echo "Raw PCM: engine_pcm_raw.h"
