// Custom hook for systems check logic
import { useState, useRef, useCallback } from 'react';
import { TelemetryResponse } from '../types';
import {
  checkConnectionStability,
  checkHullIntegrity,
  checkPowerSystems,
  checkRFCommunications,
  checkRCLink,
  checkCoreProcessor,
  checkProcessorTemperature,
  checkLEDControlPath,
  checkDFPlayerModule,
} from '../services/systemsCheckService';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useSystemsCheck(
  ip: string,
  telemetry: TelemetryResponse | null,
  isLogging: boolean,
  toggleLogging: () => void
) {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<any>(null);

  const addLog = useCallback((msg: string) => {
    console.log(`[SYSTEMS-CHECK] ${msg}`);
    setLogs(prev => [...prev, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setLogs([]);
    
    let checksPassed = 0;
    let checksFailed = 0;
    const totalChecks = 8; // DFPlayer is check 9, but non-critical, so doesn't count toward total
    
    addLog('═══════════════════════════════════════');
    addLog('EDMUND FITZGERALD SYSTEMS CHECK');
    addLog('═══════════════════════════════════════');
    await delay(800);
    
    // Run all checks sequentially
    const result1 = await checkConnectionStability(ip, addLog);
    await delay(400);
    if (result1.passed) checksPassed++; else checksFailed++;
    
    const result2 = await checkHullIntegrity(telemetry, addLog);
    await delay(400);
    if (result2.passed) checksPassed++; else checksFailed++;
    
    const result3 = await checkPowerSystems(telemetry, addLog);
    await delay(400);
    if (result3.passed) checksPassed++; else checksFailed++;
    
    const result4 = await checkRFCommunications(telemetry, addLog);
    await delay(400);
    if (result4.passed) checksPassed++; else checksFailed++;
    
    const result5 = await checkRCLink(telemetry, addLog);
    await delay(400);
    if (result5.passed) checksPassed++; else checksFailed++;
    
    const result6 = await checkCoreProcessor(telemetry, addLog);
    await delay(400);
    if (result6.passed) checksPassed++; else checksFailed++;
    
    const result7 = await checkProcessorTemperature(telemetry, addLog);
    await delay(400);
    if (result7.passed) checksPassed++; else checksFailed++;
    
    const result8 = await checkLEDControlPath(ip, telemetry, addLog);
    await delay(400);
    if (result8.passed) checksPassed++; else checksFailed++;
    
    // Non-critical check - doesn't affect pass/fail count
    const result9 = await checkDFPlayerModule(telemetry, addLog);
    await delay(400);
    
    // Final status
    addLog('═══════════════════════════════════════');
    if (checksPassed === totalChecks) {
      addLog(`✓ ALL SYSTEMS NOMINAL (${checksPassed}/${totalChecks})`);
      await delay(400);
      
      // Auto-start recording if not already logging
      if (!isLogging) {
        addLog('► Initiating telemetry recording...');
        await delay(400);
        toggleLogging();
        addLog('► Black box recorder active');
      } else {
        addLog('► Telemetry already recording');
      }
      await delay(400);
      addLog('═══════════════════════════════════════');
      addLog('★ SHIP READY FOR DEPLOYMENT ★');
    } else {
      addLog(`✗ SYSTEM CHECK FAILED (${checksPassed}/${totalChecks} passed)`);
      await delay(400);
      addLog('═══════════════════════════════════════');
      addLog('⚠ MISSION ABORT - RESOLVE FAILURES');
    }
    
    setRunning(false);
  }, [ip, telemetry, isLogging, toggleLogging, addLog]);

  return {
    logs,
    running,
    runChecks,
    scrollRef,
  };
}

