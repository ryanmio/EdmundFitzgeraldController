# Device Discovery Guide

## Overview

The Edmund Fitzgerald Bridge Console now includes a **network scanning feature** that automatically discovers ESP32 devices on your local network. You can use automatic discovery with a single tap, or continue using manual IP input if you prefer.

## How It Works

### Automatic Device Discovery

When you tap the **🔍 SCAN** button next to either the Telemetry or Camera IP fields:

1. The app scans both common home network subnets:
   - `192.168.1.x` (most common)
   - `192.168.0.x` (fallback)

2. The scanner probes each IP address in the range (1-254) to find responsive ESP32 devices

3. Devices are tested by attempting to connect to their `/status` endpoint

4. Found devices are displayed with their:
   - **Name** (auto-detected or labeled as ESP32-###)
   - **IP Address**
   - **Type** (Telemetry, Camera, or Unknown)

5. Tap any device in the list to automatically populate its IP address

### Why Two Subnets?

Different home networks use different subnet masks:
- **192.168.1.x** → Standard Linksys, TP-Link, many consumer routers
- **192.168.0.x** → Some Netgear, D-Link, and other brands

Scanning both ensures maximum compatibility.

## Features

### ✅ What's Included

- **Parallel Scanning**: Scans 20 devices at a time to find devices faster without overwhelming your network
- **Smart Timeout**: Uses 3-second timeouts per device, 15-second total scan timeout
- **Device Type Detection**: Identifies whether a device is for telemetry or camera
- **Real-Time Progress**: Shows count of devices found during scan
- **Rescan Capability**: Easily retry the scan if needed
- **Manual Input Still Available**: You can always type in an IP manually

### ⚡ Performance

- **Quick Scan Duration**: Typical network scan takes 12-15 seconds
- **Batch Processing**: Avoids flooding the network with simultaneous requests
- **Responsive UI**: Scan runs asynchronously without freezing the interface

## Usage

### Scanning for Telemetry Device

```
1. Open the app (Connection screen)
2. Tap 🔍 SCAN button next to "TELEMETRY ESP32 IP"
3. Wait for scan to complete
4. Select your ESP32 from the list
5. IP address auto-populates
```

### Scanning for Camera Device

```
1. Open the app (Connection screen)
2. Tap 🔍 SCAN button next to "CAMERA ESP32 IP"
3. Wait for scan to complete
4. Select your ESP32 from the list
5. IP address auto-populates
```

### Manual Input (Traditional Method)

You can still manually type in IP addresses. The scanner is completely optional:

```
1. Tap the IP input field
2. Delete the existing text
3. Type your IP address (e.g., 192.168.1.100)
4. Continue with connection
```

## Technical Details

### Network Scanning Service

Located in `src/services/networkScanService.ts`, the scanning service provides:

#### Main Functions

**`scanForDevices(onProgress?: callback)`**
- Scans both 192.168.1.x and 192.168.0.x subnets
- Returns array of discovered devices
- Optional progress callback updates UI with count of found devices

**`quickScan(subnet: string)`**
- Faster scan limited to a single subnet
- Default subnet: `192.168.1`
- Useful for quick checks on known networks

**`scanSubnet(subnet, startIP, endIP, onProgress?)`**
- Flexible subnet scanning with custom IP ranges
- Allows scanning specific ranges like 192.168.1.100-150
- Useful for large networks or security-restricted environments

**`probeIP(ip: string)`**
- Tests a single IP address
- Returns device info if reachable
- Includes device type detection

### Device Interface

```typescript
interface ScannedDevice {
  ip: string;
  name?: string;
  type: 'telemetry' | 'camera' | 'unknown';
  lastSeen: number;
}
```

### Device Type Detection

The scanner identifies device types by checking the `/status` endpoint response:

- **Telemetry**: Contains `sensors` field or explicit `type: "telemetry"`
- **Camera**: Contains `camera` field or explicit `type: "camera"`
- **Unknown**: Doesn't match specific patterns

## Troubleshooting

### No Devices Found

**Possible causes:**
1. ESP32 is offline or not powered
2. ESP32 is on a different subnet (not 192.168.1.x or 192.168.0.x)
3. WiFi network is on 5GHz only (some ESP32 boards only support 2.4GHz)
4. Firewall is blocking HTTP connections on port 80

**Solutions:**
- Verify ESP32 is powered and connected to WiFi
- Check your router's WiFi settings (ensure 2.4GHz is enabled)
- Confirm your phone is on the same network as the ESP32
- If on a custom subnet, use manual IP input or contact support

### Slow Scan

**Possible causes:**
1. Poor WiFi signal
2. Network congestion
3. Multiple devices timing out

**Solutions:**
- Move closer to the WiFi router
- Try rescanning (some devices may respond on retry)
- Use quick scan if you know your subnet

### Device Listed but Won't Connect

**Possible causes:**
1. Device found but `/status` endpoint not responding
2. Different firmware version
3. Network connectivity issue

**Solutions:**
- Try rescanning to see if device responds
- Verify device firmware is up to date
- Manual connection test: open browser and visit `http://[device-ip]/status`

## Advanced Usage

### Custom Subnet Scanning

If your network uses a non-standard subnet, you can modify the app to scan your specific range:

Edit `src/services/networkScanService.ts`:

```typescript
// Change this line in scanForDevices():
const rangesToCheck = [
  { base: '10.0.0', start: 1, end: 254 },    // Your custom subnet
  { base: '192.168.1', start: 1, end: 254 },
];
```

### Faster Scanning

For known networks, use the quick scan function:

```typescript
const devices = await quickScan('192.168.1'); // Only checks 100-200 range
```

## What Data Is Collected?

The scanner:
- ✅ Only probes your local network
- ✅ Does NOT send data to external servers
- ✅ Does NOT collect personal information
- ✅ Only reads from the `/status` endpoint

No telemetry or analytics are collected from the scanner.

## Future Improvements

Planned enhancements:

- [ ] mDNS/Bonjour discovery for even faster finds
- [ ] Custom subnet configuration in settings
- [ ] Device name assignment for easier identification
- [ ] Scan history and favorites
- [ ] Local IP detection for automatic subnet selection

## Code Structure

```
src/
├── services/
│   └── networkScanService.ts          # Core scanning logic
├── components/
│   └── DeviceScannerModal.tsx         # UI for device selection
└── screens/
    └── ConnectionScreen.tsx           # Integration point
```

## Support

For issues with device discovery:
1. Check the troubleshooting section above
2. Ensure ESP32 firmware includes HTTP `/status` endpoint
3. Verify ESP32 responds to: `http://[esp32-ip]/status`

