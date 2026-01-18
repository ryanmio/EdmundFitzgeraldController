// Type definitions for boat telemetry app

export interface StatusResponse {
  connected: boolean;
  ip_address: string;
  uptime_seconds: number;
  running_led: boolean;
  flood_led: boolean;
  dfplayer_available: boolean;
}

export interface TelemetryResponse {
  timestamp: string;
  battery_voltage: string;
  signal_strength: string;
  uptime_seconds: number;
  free_heap: number;
  internal_temp_c: number;
  running_mode_state: boolean;
  flood_mode_state: boolean;
  dfplayer_available: boolean;
  water_intrusion: boolean;
  water_sensor_raw: number;
  throttle_pwm: number;
  servo_pwm: number;
  engine_muted: boolean;
  connection_status: string;
  ip_address: string;
}

export interface LEDResponse {
  running_led: boolean;
  flood_led: boolean;
}

export interface HornResponse {
  horn_active: boolean;
  duration_ms: number;
}

export interface SOSResponse {
  sos_active: boolean;
  rounds: number;
}

export interface RadioResponse {
  radio_active: boolean;
  radio_id: number;
  duration_ms: number;
}

export interface MuteResponse {
  muted: boolean;
  message: string;
}

export type LEDMode = 'running' | 'flood';
export type LEDState = 'on' | 'off';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';
