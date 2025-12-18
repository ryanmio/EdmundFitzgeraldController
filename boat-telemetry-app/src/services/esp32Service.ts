// ESP32 HTTP service with timeout support
import { StatusResponse, TelemetryResponse, LEDResponse, LEDMode, LEDState } from '../types';

const TIMEOUT_MS = 5000;

/**
 * Fetch wrapper with timeout support
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build base URL from IP address
 */
function buildUrl(ip: string, endpoint: string): string {
  // Remove any existing protocol or trailing slashes
  const cleanIp = ip.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `http://${cleanIp}${endpoint}`;
}

/**
 * Check connection to ESP32 by calling /status endpoint
 */
export async function checkConnection(ip: string): Promise<StatusResponse> {
  const url = buildUrl(ip, '/status');
  const response = await fetchWithTimeout(url);
  
  if (!response.ok) {
    throw new Error(`Connection failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get telemetry data from ESP32
 */
export async function getTelemetry(ip: string): Promise<TelemetryResponse> {
  const url = buildUrl(ip, '/telemetry');
  const response = await fetchWithTimeout(url);
  
  if (!response.ok) {
    throw new Error(`Telemetry request failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Set LED state on ESP32
 */
export async function setLED(ip: string, mode: LEDMode, state: LEDState): Promise<LEDResponse> {
  const url = buildUrl(ip, '/led');
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode, state }),
  });
  
  if (!response.ok) {
    throw new Error(`LED control failed: ${response.status}`);
  }
  
  return response.json();
}

