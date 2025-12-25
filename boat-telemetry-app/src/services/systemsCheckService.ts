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
  addLog('[1/7] Testing connection stability...');
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
  addLog('[2/7] Checking hull integrity...');
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
  addLog('[3/7] Measuring DC bus potential...');
  await delay(600);
  
  if (!telemetry) {
    addLog(`  ⚠ No telemetry data available`);
    return { passed: false, message: 'No telemetry data available' };
  }
  
  const voltage = parseFloat(telemetry.battery_voltage);
  if (voltage < 11.5) {
    addLog(`  ✗ Low voltage warning (${telemetry.battery_voltage})`);
    return { passed: false, message: `Low voltage warning (${telemetry.battery_voltage})` };
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
  addLog('[4/7] Analyzing signal strength...');
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
  addLog('[5/7] Validating RC receiver...');
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
  addLog('[6/7] Checking processor health...');
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
 * Check 7: LED Functional Test
 */
export async function checkLEDControlPath(
  ip: string,
  telemetry: TelemetryResponse | null,
  addLog: (msg: string) => void
): Promise<CheckResult> {
  addLog('[7/7] Testing LED control path...');
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

