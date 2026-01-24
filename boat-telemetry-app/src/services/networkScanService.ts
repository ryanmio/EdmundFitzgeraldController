/**
 * Network scanning service for discovering ESP32 devices on the local network
 * Uses progressive scanning strategy:
 * 1. Probe recently-used IPs first (instant feedback)
 * 2. Scan subnet ranges in parallel
 * 3. Allow device selection while scanning continues
 */

export interface ScannedDevice {
  ip: string;
  name?: string;
  type: 'telemetry' | 'camera' | 'unknown';
  lastSeen: number;
}

const TIMEOUT_MS = 2000; // 2 second timeout per device
const QUICK_PROBE_TIMEOUT_MS = 1000; // Faster timeout for known IPs

// Subnet ranges to scan (in priority order)
const COMMON_IP_RANGES = [
  { base: '192.168.1', start: 100, end: 200 }, // Most common range for static/DHCP
  { base: '192.168.0', start: 100, end: 200 },
];

// Storage key for recently found devices
const RECENTLY_FOUND_STORAGE_KEY = 'esp32_recently_found_ips';

/**
 * Fetch wrapper with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
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
  const cleanIp = ip.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `http://${cleanIp}${endpoint}`;
}

/**
 * Check if an IP is reachable and what type of device it is
 */
async function probeIP(
  ip: string,
  timeoutMs: number = TIMEOUT_MS
): Promise<ScannedDevice | null> {
  try {
    const url = buildUrl(ip, '/status');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[NetworkScan] ${ip} responded:`, JSON.stringify(data).substring(0, 100));
        
        // Determine device type based on response
        let type: 'telemetry' | 'camera' | 'unknown' = 'unknown';
        
        // Check for telemetry indicators
        if (data.type === 'telemetry' || data.sensors || data.battery_voltage || 
            data.running_led !== undefined || data.flood_led !== undefined) {
          type = 'telemetry';
        } 
        // Check for camera indicators
        else if (data.type === 'camera' || data.camera === 'online' || data.camera) {
          type = 'camera';
        }

        return {
          ip,
          name: data.name || `ESP32-${ip.split('.')[3]}`,
          type,
          lastSeen: Date.now(),
        };
      } else {
        console.log(`[NetworkScan] ${ip} returned status ${response.status}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    // Silently ignore timeouts and network errors (expected for most IPs)
    // Only log if it's not a timeout/network error
    if (error?.message && !error.message.includes('aborted') && !error.message.includes('Network')) {
      console.log(`[NetworkScan] ${ip} error:`, error.message);
    }
  }

  return null;
}

/**
 * Get recently found device IPs from storage
 */
function getRecentlyFoundIPs(): string[] {
  try {
    // In a React Native app, you'd use AsyncStorage
    // For now, return empty array - component will handle storage
    return [];
  } catch {
    return [];
  }
}

/**
 * Store recently found device IP
 */
function saveRecentIP(ip: string): void {
  try {
    // Component will handle storage persistence via AsyncStorage
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Get the local network IP to determine the subnet
 */
async function getLocalIP(): Promise<string | null> {
  // In a real app, we'd use a native module to get the actual local IP
  // For now, we'll use a fallback approach
  try {
    // Try to connect to a remote server and get the local IP from the response
    const response = await fetchWithTimeout('http://192.168.1.1', {
      method: 'HEAD',
    });
  } catch (error) {
    // Ignore errors - we'll use a default subnet
  }

  // Default assumption for home networks
  return '192.168.1.1';
}

/**
 * Progressive scan: Quick probe of known IPs first, then full subnet scan
 * Returns immediately with recently found devices, continues scanning in background
 * 
 * @param recentlyUsedIPs - IPs that were recently found (should be provided by component)
 * @param onProgress - Callback called as devices are found (immediately shows results)
 * @returns Promise that resolves when scan is complete
 */
export async function scanForDevices(
  onProgress?: (found: number, checked: number, total: number) => void,
  recentlyUsedIPs: string[] = []
): Promise<ScannedDevice[]> {
  const devices: ScannedDevice[] = [];
  let checkedCount = 0;
  
  console.log('[NetworkScan] Starting progressive device scan...');
  console.log('[NetworkScan] Recently used IPs:', recentlyUsedIPs);

  // Phase 1: Quickly probe recently used IPs (should be instant if devices are online)
  if (recentlyUsedIPs.length > 0) {
    console.log(`[NetworkScan] Phase 1: Probing ${recentlyUsedIPs.length} recently used IPs...`);
    
    const recentResults = await Promise.all(
      recentlyUsedIPs.map(ip => probeIP(ip, QUICK_PROBE_TIMEOUT_MS))
    );

    recentResults.forEach((result, idx) => {
      if (result) {
        console.log(`[NetworkScan] Found recent device at ${result.ip}`);
        devices.push(result);
      }
      checkedCount++;
    });

    // Report progress after recent IPs checked
    const totalEstimate = recentlyUsedIPs.length + COMMON_IP_RANGES.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
    onProgress?.(devices.length, checkedCount, totalEstimate);
  }

  // Phase 2: Scan subnet ranges in parallel for faster coverage
  console.log('[NetworkScan] Phase 2: Scanning full subnets in parallel...');
  
  const allIPs: string[] = [];
  for (const range of COMMON_IP_RANGES) {
    for (let i = range.start; i <= range.end; i++) {
      allIPs.push(`${range.base}.${i}`);
    }
  }

  // Filter out IPs we already checked
  const recentIPSet = new Set(recentlyUsedIPs);
  const uncheckedIPs = allIPs.filter(ip => !recentIPSet.has(ip));
  
  console.log(`[NetworkScan] Scanning ${uncheckedIPs.length} unchecked IP addresses`);

  // Probe in parallel batches for speed
  const batchSize = 15; // Increased batch size since we're doing it faster
  
  for (let i = 0; i < uncheckedIPs.length; i += batchSize) {
    const batch = uncheckedIPs.slice(i, i + batchSize);
    
    const results = await Promise.all(batch.map(ip => probeIP(ip)));

    results.forEach(result => {
      if (result) {
        console.log(`[NetworkScan] Found device at ${result.ip} (type: ${result.type})`);
        
        // Avoid duplicates
        if (!devices.find(d => d.ip === result.ip)) {
          devices.push(result);
          saveRecentIP(result.ip);
        }
      }
    });

    checkedCount += batch.length;
    onProgress?.(devices.length, recentlyUsedIPs.length + checkedCount, recentlyUsedIPs.length + allIPs.length);
  }

  console.log(`[NetworkScan] Scan complete. Found ${devices.length} devices.`);

  // Sort by type (telemetry first), then by IP
  devices.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'telemetry' ? -1 : 1;
    }
    return a.ip.localeCompare(b.ip);
  });

  return devices;
}

/**
 * Scan a specific subnet range
 * Useful if you want to target a specific network segment
 */
export async function scanSubnet(
  subnet: string,
  startIP: number = 1,
  endIP: number = 254,
  onProgress?: (found: number, checked: number) => void
): Promise<ScannedDevice[]> {
  const devices: ScannedDevice[] = [];
  const ips: string[] = [];

  for (let i = startIP; i <= endIP; i++) {
    ips.push(`${subnet}.${i}`);
  }

  const batchSize = 20;
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(ip => probeIP(ip)));

    results.forEach(result => {
      if (result) {
        devices.push(result);
      }
    });

    onProgress?.(devices.length, i + batch.length);
  }

  return devices;
}


