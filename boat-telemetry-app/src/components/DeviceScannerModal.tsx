import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScannedDevice, scanForDevices } from '../services/networkScanService';
import { COLORS, FONTS } from '../constants/Theme';

interface DeviceScannerModalProps {
  visible: boolean;
  onSelectDevice: (ip: string) => void;
  onClose: () => void;
  deviceType?: 'telemetry' | 'camera';
  title?: string;
}

const RECENTLY_FOUND_STORAGE_KEY = 'esp32_recently_found_ips';

export const DeviceScannerModal: React.FC<DeviceScannerModalProps> = ({
  visible,
  onSelectDevice,
  onClose,
  deviceType = 'telemetry',
  title = 'SCAN FOR DEVICES',
}) => {
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [devicesFound, setDevicesFound] = useState(0);
  const [ipsChecked, setIpsChecked] = useState(0);
  const [totalToScan, setTotalToScan] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [recentlyUsedIPs, setRecentlyUsedIPs] = useState<string[]>([]);

  // Load recently found IPs on mount
  useEffect(() => {
    loadRecentlyFoundIPs();
  }, []);

  useEffect(() => {
    if (visible && !scanning) {
      startScan();
    }
  }, [visible]);

  const loadRecentlyFoundIPs = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENTLY_FOUND_STORAGE_KEY);
      if (stored) {
        const ips = JSON.parse(stored) as string[];
        setRecentlyUsedIPs(ips);
        console.log('[DeviceScanner] Loaded recently found IPs:', ips);
      }
    } catch (error) {
      console.error('[DeviceScanner] Failed to load recently found IPs:', error);
    }
  };

  const saveRecentlyFoundIPs = async (allDevices: ScannedDevice[]) => {
    try {
      const ips = allDevices.map(d => d.ip);
      await AsyncStorage.setItem(RECENTLY_FOUND_STORAGE_KEY, JSON.stringify(ips));
      console.log('[DeviceScanner] Saved recently found IPs:', ips);
    } catch (error) {
      console.error('[DeviceScanner] Failed to save recently found IPs:', error);
    }
  };

  const startScan = async () => {
    console.log('[DeviceScanner] Starting scan...');
    setScanning(true);
    setScanComplete(false);
    setDevices([]);
    setDevicesFound(0);
    setIpsChecked(0);
    setTotalToScan(0);

    try {
      const foundDevices = await scanForDevices(
        (found, checked, total) => {
          setDevicesFound(found);
          setIpsChecked(checked);
          setTotalToScan(total);
        },
        recentlyUsedIPs
      );
      
      console.log(`[DeviceScanner] Scan complete. Found ${foundDevices.length} devices`);
      
      // Filter devices based on type if specified
      let filtered = foundDevices;
      if (deviceType) {
        filtered = foundDevices.filter(d => d.type === deviceType || d.type === 'unknown');
      }
      
      setDevices(filtered);
      await saveRecentlyFoundIPs(filtered);
    } catch (error) {
      console.error('[DeviceScanner] Scan failed:', error);
    } finally {
      setScanning(false);
      setScanComplete(true);
    }
  };

  const handleSelectDevice = (ip: string) => {
    onSelectDevice(ip);
    handleClose();
  };

  const handleClose = () => {
    setDevices([]);
    setDevicesFound(0);
    setScanComplete(false);
    onClose();
  };

  const getDeviceTypeLabel = (type: string): string => {
    switch (type) {
      case 'telemetry':
        return '📊 TELEMETRY';
      case 'camera':
        return '📷 CAMERA';
      default:
        return '🔍 UNKNOWN';
    }
  };

  const renderDeviceItem = ({ item }: { item: ScannedDevice }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleSelectDevice(item.ip)}
      activeOpacity={0.7}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceIP}>{item.ip}</Text>
        <Text style={styles.deviceType}>{getDeviceTypeLabel(item.type)}</Text>
      </View>
      <View style={styles.deviceArrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {scanning ? (
              <View style={styles.scanningContainer}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.accent}
                  style={styles.spinner}
                />
                <Text style={styles.scanningText}>SCANNING NETWORK...</Text>
                {totalToScan > 0 && (
                  <Text style={styles.progressText}>
                    {ipsChecked} / {totalToScan} IPs checked
                  </Text>
                )}
                <Text style={styles.devicesFoundText}>
                  DEVICES FOUND: {devicesFound}
                </Text>
              </View>
            ) : (
              <>
                {devices.length > 0 ? (
                  <FlatList
                    data={devices}
                    renderItem={renderDeviceItem}
                    keyExtractor={(item) => item.ip}
                    scrollEnabled={true}
                    style={styles.deviceList}
                  />
                ) : scanComplete ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      NO DEVICES FOUND
                    </Text>
                    <Text style={styles.emptyHint}>
                      ENSURE ESP32 IS CONNECTED TO NETWORK
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {!scanning && (
              <TouchableOpacity
                style={styles.rescanButton}
                onPress={startScan}
                activeOpacity={0.7}
              >
                <Text style={styles.rescanButtonText}>RESCAN</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.accent,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#05070a',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.accent,
    fontFamily: FONTS.monospace,
    letterSpacing: 1,
  },
  content: {
    paddingVertical: 16,
    maxHeight: 400,
  },
  scanningContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  scanningText: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  progressText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    marginTop: 4,
  },
  devicesFoundText: {
    fontSize: 11,
    color: COLORS.accent,
    fontFamily: FONTS.monospace,
    marginTop: 8,
  },
  deviceList: {
    paddingHorizontal: 8,
    maxHeight: 350,
  },
  deviceItem: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 4,
    marginHorizontal: 8,
    backgroundColor: '#05070a',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    marginBottom: 2,
  },
  deviceIP: {
    fontSize: 11,
    color: COLORS.accent,
    fontFamily: FONTS.monospace,
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
  },
  deviceArrow: {
    marginLeft: 12,
  },
  arrowText: {
    fontSize: 18,
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 11,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#05070a',
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary,
    gap: 8,
  },
  rescanButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
    alignItems: 'center',
  },
  rescanButtonText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: FONTS.monospace,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.alert,
    borderRadius: 4,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: FONTS.monospace,
  },
});

