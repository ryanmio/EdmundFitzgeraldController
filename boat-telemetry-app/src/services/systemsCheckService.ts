// Systems check service - individual check functions
import { getTelemetry, setLED } from './esp32Service';
import { TelemetryResponse } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type CheckResult = {
  passed: boolean;
  message: string;
};

/**
 * Check 1: Connection Stability
 */
export async function checkConnectionStability(
  ip: string,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[1/8] Testing connection stability...');
  await delay(400);
  
  try {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await getTelemetry(ip);
      times.push(Date.now() - start);
      await delay(100);
    }
    const avg = Math.round(times.reduce((a, b) => a + b) / times.length);
    const max = Math.max(...times);
    
    if (max > 3000) {
      addLog(`  ✗ Link unstable (avg: ${avg}ms, max: ${max}ms)`);
      return { passed: false, message: `Link unstable (avg: ${avg}ms, max: ${max}ms)` };
    } else {
      addLog(`  ✓ Link stable (avg: ${avg}ms, max: ${max}ms)`);
      return { passed: true, message: `Link stable (avg: ${avg}ms, max: ${max}ms)` };
    }
  } catch (err) {
    addLog(`  ✗ Connection test failed`);
    return { passed: false, message: 'Connection test failed' };
  }
}

/**
 * Check 2: Hull Integrity
 */
export async function checkHullIntegrity(
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[2/8] Checking hull integrity...');
  await delay(600);
  
  if (!telemetry) {
    addLog(`  ⚠ No telemetry data available`);
    return { passed: false, message: 'No telemetry data available' };
  }
  
  if (telemetry.water_intrusion) {
    addLog(`  ✗ CRITICAL: Water intrusion detected`);
    return { passed: false, message: 'CRITICAL: Water intrusion detected' };
  } else {
    addLog(`  ✓ Hull secure - no intrusion`);
    return { passed: true, message: 'Hull secure - no intrusion' };
  }
}

/**
 * Check 3: Power Systems
 */
export async function checkPowerSystems(
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[3/8] Measuring DC bus potential...');
  await delay(600);
  
  if (!telemetry) {
    addLog(`  ⚠ No telemetry data available`);
    return { passed: false, message: 'No telemetry data available' };
  }
  
  const voltage = parseFloat(telemetry.battery_voltage);
  if (voltage < 8.1 || voltage > 8.8) {
    addLog(`  ✗ Voltage out of range (${telemetry.battery_voltage})`);
    return { passed: false, message: `Voltage out of range (${telemetry.battery_voltage})` };
  } else {
    addLog(`  ✓ Nominal voltage (${telemetry.battery_voltage})`);
    return { passed: true, message: `Nominal voltage (${telemetry.battery_voltage})` };
  }
}

/**
 * Check 4: RF Communications
 */
export async function checkRFCommunications(
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[4/8] Analyzing signal strength...');
  await delay(600);
  
  if (!telemetry) {
    addLog(`  ⚠ No telemetry data available`);
    return { passed: false, message: 'No telemetry data available' };
  }
  
  const rssi = parseInt(telemetry.signal_strength.replace('dBm', ''));
  if (rssi < -85) {
    addLog(`  ✗ Weak signal (${telemetry.signal_strength})`);
    return { passed: false, message: `Weak signal (${telemetry.signal_strength})` };
  } else {
    addLog(`  ✓ Signal adequate (${telemetry.signal_strength})`);
    return { passed: true, message: `Signal adequate (${telemetry.signal_strength})` };
  }
}

/**
 * Check 5: RC Link
 */
export async function checkRCLink(
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[5/8] Validating RC receiver...');
  await delay(700);
  
  if (!telemetry || typeof telemetry.throttle_pwm !== 'number' || typeof telemetry.servo_pwm !== 'number') {
    addLog(`  ⚠ RC telemetry unavailable`);
    return { passed: false, message: 'RC telemetry unavailable' };
  }
  
  if (telemetry.throttle_pwm === 0 && telemetry.servo_pwm === 0) {
    addLog(`  ✗ No RC signal detected`);
    return { passed: false, message: 'No RC signal detected' };
  } else {
    addLog(`  ✓ RC link established (THR:${telemetry.throttle_pwm}µs, SRV:${telemetry.servo_pwm}µs)`);
    return { passed: true, message: `RC link established (THR:${telemetry.throttle_pwm}µs, SRV:${telemetry.servo_pwm}µs)` };
  }
}

/**
 * Check 6: Core Processor
 */
export async function checkCoreProcessor(
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[6/8] Checking processor health...');
  await delay(600);
  
  if (!telemetry || typeof telemetry.free_heap !== 'number' || isNaN(telemetry.free_heap)) {
    addLog(`  ⚠ Heap telemetry unavailable`);
    return { passed: false, message: 'Heap telemetry unavailable' };
  }
  
  const heapKB = Math.round(telemetry.free_heap / 1024);
  if (telemetry.free_heap < 50000) {
    addLog(`  ✗ Low memory (${heapKB}KB free)`);
    return { passed: false, message: `Low memory (${heapKB}KB free)` };
  } else {
    addLog(`  ✓ Memory OK (${heapKB}KB free, uptime: ${telemetry.uptime_seconds}s)`);
    return { passed: true, message: `Memory OK (${heapKB}KB free, uptime: ${telemetry.uptime_seconds}s)` };
  }
}

/**
 * Check 7: Processor Temperature
 */
export async function checkProcessorTemperature(
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[7/8] Scanning thermal sensors...');
  await delay(600);
  
  if (!telemetry || typeof telemetry.internal_temp_c !== 'number' || isNaN(telemetry.internal_temp_c)) {
    addLog(`  ⚠ Temperature telemetry unavailable`);
    return { passed: false, message: 'Temperature telemetry unavailable' };
  }
  
  const tempC = telemetry.internal_temp_c;
  if (tempC > 85) {
    addLog(`  ✗ CRITICAL: Overheating detected (${tempC.toFixed(1)}°C)`);
    return { passed: false, message: `CRITICAL: Overheating detected (${tempC.toFixed(1)}°C)` };
  } else if (tempC > 75) {
    addLog(`  ⚠ WARNING: High temperature (${tempC.toFixed(1)}°C)`);
    return { passed: false, message: `WARNING: High temperature (${tempC.toFixed(1)}°C)` };
  } else {
    addLog(`  ✓ Thermal nominal (${tempC.toFixed(1)}°C)`);
    return { passed: true, message: `Thermal nominal (${tempC.toFixed(1)}°C)` };
  }
}

/**
 * Check 8: LED Functional Test
 */
export async function checkLEDControlPath(
  ip: string,
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[8/8] Testing LED control path...');
  await delay(500);
  
  try {
    const originalRunning = telemetry?.running_mode_state || false;
    const originalFlood = telemetry?.flood_mode_state || false;
    
    // Cycle running lights
    await setLED(ip, 'running', 'on');
    await delay(300);
    await setLED(ip, 'running', 'off');
    await delay(300);
    
    // Cycle flood lights
    await setLED(ip, 'flood', 'on');
    await delay(300);
    await setLED(ip, 'flood', 'off');
    await delay(300);
    
    // Restore original states
    await setLED(ip, 'running', originalRunning ? 'on' : 'off');
    await setLED(ip, 'flood', originalFlood ? 'on' : 'off');
    
    addLog(`  ✓ Control path verified`);
    return { passed: true, message: 'Control path verified' };
  } catch (err) {
    addLog(`  ✗ Control path failure`);
    return { passed: false, message: 'Control path failure' };
  }
}

