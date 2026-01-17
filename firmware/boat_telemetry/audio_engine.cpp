// audio_engine.cpp
// Implementation of real-time engine audio sampler

#include "audio_engine.h"
#include "engine_pcm.h"  // Generated header with ENGINE_PCM_DATA, ENGINE_PCM_LENGTH
#include <Arduino.h>

// Global engine state
EngineAudioState engineState;

// Initialize audio engine
void audioEngine_init() {
  engineState.position = 0.0f;
  engineState.rate = 1.0f;
  engineState.gain = GAIN_MIN;
  engineState.smoothed_throttle = 0.0f;
  engineState.prev_throttle = 0.0f;
  engineState.rev_timer_ms = 0;
  engineState.last_update_ms = millis();
  engineState.hp_prev_in = 0.0f;
  engineState.hp_prev_out = 0.0f;
  
  Serial.println("Audio engine initialized");
  Serial.printf("  PCM samples: %d (%.2fs @ %d Hz)\n", 
    ENGINE_PCM_LENGTH, 
    (float)ENGINE_PCM_LENGTH / ENGINE_PCM_SAMPLE_RATE,
    ENGINE_PCM_SAMPLE_RATE);
  Serial.printf("  Rate range: %.2f - %.2f\n", RATE_MIN, RATE_MAX);
  Serial.printf("  Gain range: %.2f - %.2f\n", GAIN_MIN, GAIN_MAX);
}

// Update throttle and recalculate rate/gain
void audioEngine_updateThrottle(float throttle_normalized) {
  // Clamp input
  if (throttle_normalized < 0.0f) throttle_normalized = 0.0f;
  if (throttle_normalized > 1.0f) throttle_normalized = 1.0f;
  
  // Calculate time delta for decay
  uint32_t current_ms = millis();
  uint32_t delta_ms = current_ms - engineState.last_update_ms;
  engineState.last_update_ms = current_ms;
  
  // Detect rev transient (rapid throttle increase)
  float throttle_delta = throttle_normalized - engineState.prev_throttle;
  if (throttle_delta > REV_THRESHOLD) {
    engineState.rev_timer_ms = REV_DECAY_MS + REV_RAMP_MS;
  }
  engineState.prev_throttle = throttle_normalized;
  
  // Decay rev timer
  if (engineState.rev_timer_ms > 0) {
    if (delta_ms >= engineState.rev_timer_ms) {
      engineState.rev_timer_ms = 0;
    } else {
      engineState.rev_timer_ms -= delta_ms;
    }
  }
  
  // Apply faster smoothing during rev transient for more responsive feel
  float smooth_alpha = THROTTLE_SMOOTH_ALPHA;
  if (engineState.rev_timer_ms > 0) {
    smooth_alpha = 0.35f;  // Much faster response during rev
  }
  
  // Exponential smoothing (boat-like inertia, faster during rev)
  engineState.smoothed_throttle = 
    engineState.smoothed_throttle * (1.0f - smooth_alpha) +
    throttle_normalized * smooth_alpha;
  
  // Calculate base rate and gain from smoothed throttle
  float base_rate = RATE_MIN + engineState.smoothed_throttle * (RATE_MAX - RATE_MIN);
  float base_gain = GAIN_MIN + engineState.smoothed_throttle * (GAIN_MAX - GAIN_MIN);
  
  // Apply rev boost if active (ramp-in then decay for realistic effect)
  if (engineState.rev_timer_ms > 0) {
    float total_time = REV_DECAY_MS + REV_RAMP_MS;
    float rev_elapsed = total_time - engineState.rev_timer_ms;
    
    float rev_amount = 0.0f;
    if (rev_elapsed < REV_RAMP_MS) {
      // Ramp-in phase: smoothly increase rev effect
      rev_amount = rev_elapsed / REV_RAMP_MS;
    } else {
      // Decay phase: gradually fade rev effect
      float decay_elapsed = rev_elapsed - REV_RAMP_MS;
      rev_amount = 1.0f - (decay_elapsed / REV_DECAY_MS);
    }
    
    base_rate *= 1.0f + (REV_BOOST_RATE - 1.0f) * rev_amount;
    base_gain *= 1.0f + (REV_BOOST_GAIN - 1.0f) * rev_amount;
  }
  
  // Update state
  engineState.rate = base_rate;
  engineState.gain = base_gain;
}

// Linear interpolation helper
static inline float lerp(float a, float b, float t) {
  return a + (b - a) * t;
}

// High-pass filter to remove bass frequencies that cause speaker rattling
// Simple 1st order HPF at ~150Hz to cut out rumble that small speakers can't handle
static inline float highPassFilter(float input) {
  const float alpha = 0.98f;  // ~150Hz cutoff at 44.1kHz
  
  float output = alpha * (engineState.hp_prev_out + input - engineState.hp_prev_in);
  
  engineState.hp_prev_in = input;
  engineState.hp_prev_out = output;
  
  return output;
}

// Render PCM samples into buffer
void audioEngine_renderSamples(int16_t* buffer, size_t count) {
  for (size_t i = 0; i < count; i++) {
    // Get integer and fractional parts of position
    uint32_t idx = (uint32_t)engineState.position;
    float frac = engineState.position - (float)idx;
    
    // Wrap around loop boundary
    if (idx >= ENGINE_PCM_LENGTH) {
      idx = idx % ENGINE_PCM_LENGTH;
      engineState.position = (float)idx + frac;
    }
    
    // Get current and next samples for interpolation
    int16_t sample0 = ENGINE_PCM_DATA[idx];
    int16_t sample1 = ENGINE_PCM_DATA[(idx + 1) % ENGINE_PCM_LENGTH];
    
    // Linear interpolation for smooth pitch shifting
    float interpolated = lerp((float)sample0, (float)sample1, frac);
    
    // Apply high-pass filter BEFORE gain to remove bass that causes rattling
    interpolated = highPassFilter(interpolated);
    
    // Apply gain
    interpolated *= engineState.gain;
    
    // Simple clipping
    if (interpolated > 32767.0f) interpolated = 32767.0f;
    if (interpolated < -32768.0f) interpolated = -32768.0f;
    
    buffer[i] = (int16_t)interpolated;
    
    // Advance position by playback rate
    engineState.position += engineState.rate;
  }
}
