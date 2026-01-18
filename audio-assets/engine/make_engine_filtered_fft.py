#!/usr/bin/env python3
import sys
import os
import numpy as np
from scipy.io import wavfile
from scipy.fft import rfft, irfft, rfftfreq

def main():
    if len(sys.argv) < 3:
        print("Usage: make_engine_filtered_fft.py <input_wav> <output_wav>")
        sys.exit(1)

    input_wav = sys.argv[1]
    output_wav = sys.argv[2]

    # 1. Read input WAV
    sr, data = wavfile.read(input_wav)
    
    # 2. Convert to float32
    x = data.astype(np.float32) / 32768.0
    
    # 3. Remove DC
    x = x - np.mean(x)
    
    # 4. Apply FFT
    X = rfft(x)
    freqs = rfftfreq(len(x), 1/sr)
    
    # 5. Apply smooth high-pass magnitude curve (circular)
    fc = 300.0
    n = 4
    H = np.zeros_like(freqs)
    H[1:] = 1.0 / np.sqrt(1 + (fc / freqs[1:])**(2*n))
    Y = X * H
    
    # 6. Inverse FFT
    y = irfft(Y, n=len(x))
    
    # 7. Apply tiny fade-in/out (3ms) to kill startup step
    fade_len = int(sr * 0.003)
    fade_in = np.linspace(0, 1, fade_len)
    fade_out = np.linspace(1, 0, fade_len)
    y[:fade_len] *= fade_in
    y[-fade_len:] *= fade_out
    
    # 8. Normalize to preserve loudness
    peak = np.max(np.abs(y))
    if peak > 0:
        y = y * (0.98 / peak)
    
    # 9. Write output WAV
    output_data = (y * 32767.0).astype(np.int16)
    wavfile.write(output_wav, sr, output_data)
    
    # Boundary mismatch debug
    mismatch = abs(int(output_data[0]) - int(output_data[-1]))
    print(f"✓ Generated {output_wav}")
    print(f"  Boundary mismatch: {mismatch} counts")
    print(f"  Peak level: {np.max(np.abs(y))*100:.1f}%")

if __name__ == "__main__":
    main()
