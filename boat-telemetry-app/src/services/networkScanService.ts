/**
 * Network scanning service for discovering ESP32 devices on the local network
 * Uses ping-based discovery to find devices in the IP range
 */

export interface ScannedDevice {
  ip: string;
  name?: string;
  type: 'telemetry' | 'camera' | 'unknown';
  lastSeen: number;
}

const TIMEOUT_MS = 2000; // 2 second timeout per device
const COMMON_IP_RANGES = [
  { base: '192.168.1', start: 100, end: 200 }, // Most common range for static/DHCP
  { base: '192.168.0', start: 100, end: 200 },
];

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
async function probeIP(ip: string): Promise<ScannedDevice | null> {
  try {
    const url = buildUrl(ip, '/status');
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
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
 * Scan the local network for ESP32 devices
 * Scans common IP ranges (192.168.1.100-200 and 192.168.0.100-200)
 */
export async function scanForDevices(
  onProgress?: (found: number, checked: number, total: number) => void
): Promise<ScannedDevice[]> {
  const devices: ScannedDevice[] = [];
  
  console.log('[NetworkScan] Starting device scan...');

  // Create an array of all IPs to check (focused on common DHCP/static ranges)
  const allIPs: string[] = [];
  for (const range of COMMON_IP_RANGES) {
    for (let i = range.start; i <= range.end; i++) {
      allIPs.push(`${range.base}.${i}`);
    }
  }

  console.log(`[NetworkScan] Scanning ${allIPs.length} IP addresses`);

  // Probe IPs in smaller batches to be more reliable on mobile
  const batchSize = 10;
  let checkedCount = 0;
  
  for (let i = 0; i < allIPs.length; i += batchSize) {
    const batch = allIPs.slice(i, i + batchSize);
    console.log(`[NetworkScan] Checking batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allIPs.length/batchSize)}`);
    
    const results = await Promise.all(batch.map(ip => probeIP(ip)));

    results.forEach(result => {
      if (result) {
        console.log(`[NetworkScan] Found device at ${result.ip} (type: ${result.type})`);
        devices.push(result);
      }
    });

    checkedCount += batch.length;
    onProgress?.(devices.length, checkedCount, allIPs.length);
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
 * Quick scan for devices - only checks specific IPs
 * Useful for faster discovery if you know the subnet
 */
export async function quickScan(subnet: string = '192.168.1'): Promise<ScannedDevice[]> {
  const devices: ScannedDevice[] = [];
  
  // Try common ESP32 device IPs
  const commonIPs = [];
  for (let i = 100; i <= 200; i++) {
    commonIPs.push(`${subnet}.${i}`);
  }

  const results = await Promise.all(commonIPs.map(ip => probeIP(ip)));
  
  results.forEach(result => {
    if (result) {
      devices.push(result);
    }
  });

  return devices;
}

/**
 * Scan a specific subnet range
 */
export async function scanSubnet(
  subnet: string,
  startIP: number = 1,
  endIP: number = 254,
  onProgress?: (found: number) => void
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

    onProgress?.(devices.length);
  }

  return devices;
}

