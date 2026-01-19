// audio_engine.h
// Real-time engine audio sampler with throttle-driven pitch and volume control
// Uses FFT-filtered PCM (offline processing) for click-free looping

#ifndef AUDIO_ENGINE_H
#define AUDIO_ENGINE_H

#include <stdint.h>
#include <cstddef>

// Tuning parameters
#define THROTTLE_SMOOTH_ALPHA   0.15f   // Exponential smoothing (0.1=slow, 0.5=fast)
#define RATE_MIN                0.8f    // Minimum playback rate (pitch at idle)
#define RATE_MAX                1.5f    // Maximum playback rate (pitch at full throttle)
#define GAIN_MIN                0.55f   // Minimum gain (volume at idle) - adequate presence without over-stressing speaker
#define GAIN_MAX                0.8f    // Maximum gain (volume at full throttle) - slightly reduced to prevent speaker rattle
#define REV_BOOST_RATE          1.25f   // Rate multiplier during rev (25% boost)
#define REV_BOOST_GAIN          1.4f    // Gain multiplier during rev (40% boost)
#define REV_RAMP_MS             150     // Rev ramp-in time (milliseconds)
#define REV_DECAY_MS            400     // Rev transient decay time (milliseconds)
#define REV_THRESHOLD           0.15f   // Throttle delta to trigger rev transient
#define START_FADE_MS           10      // Startup fade-in to prevent initial pop

// Audio engine state
typedef struct {
  float position;           // Fractional sample position in loop
  float rate;               // Current playback rate (1.0 = normal pitch)
  float gain;               // Current volume multiplier
  float smoothed_throttle;  // Low-pass filtered throttle value
  float prev_throttle;      // Previous throttle for derivative calculation
  uint32_t rev_timer_ms;    // Milliseconds remaining in rev transient
  uint32_t last_update_ms;  // Timestamp of last update (for decay)
  uint32_t startup_fade_remaining; // Samples remaining in startup fade
  bool muted;               // Mute flag (true = output silence)
} EngineAudioState;

// Global engine state (accessed by audio task)
extern EngineAudioState engineState;

// Initialize audio engine
void audioEngine_init();

// Update throttle and recalculate rate/gain
// throttle_normalized: 0.0 = idle, 1.0 = full throttle
void audioEngine_updateThrottle(float throttle_normalized);

// Render PCM samples into buffer
// buffer: output buffer (16-bit signed mono)
// count: number of samples to render
void audioEngine_renderSamples(int16_t* buffer, size_t count);

// Mute control
void audioEngine_setMuted(bool muted);
bool audioEngine_getMuted();

// Get current state (for debugging)
inline float audioEngine_getRate() { return engineState.rate; }
inline float audioEngine_getGain() { return engineState.gain; }
inline float audioEngine_getSmoothedThrottle() { return engineState.smoothed_throttle; }
inline bool audioEngine_isRevActive() { return engineState.rev_timer_ms > 0; }

#endif // AUDIO_ENGINE_H
