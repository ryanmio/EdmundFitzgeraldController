import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '../constants/Theme';
import { getSystemDebug, getEngineDebug } from '../services/esp32Service';

interface SystemDebugInfo {
  dfplayer_available: boolean;
  adc_initialized: boolean;
  firmware_version: string;
  build_id: string;
  uptime_ms: number;
  free_heap: number;
}

interface EngineDebugInfo {
  throttle_raw_us: number;
  throttle_normalized: number;
  throttle_smoothed: number;
  engine_rate: number;
  engine_gain: number;
  rev_active: boolean;
  last_update_ms: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  ip: string;
}

export const SystemDebugModal: React.FC<Props> = ({ visible, onClose, ip }) => {
  const [systemDebug, setSystemDebug] = useState<SystemDebugInfo | null>(null);
  const [engineDebug, setEngineDebug] = useState<EngineDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchDebugInfo = async () => {
    if (!visible) return;
    
    setLoading(true);
    try {
      const [sysInfo, engInfo] = await Promise.all([
        getSystemDebug(ip),
        getEngineDebug(ip),
      ]);
      setSystemDebug(sysInfo);
      setEngineDebug(engInfo);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch debug info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchDebugInfo();
      const interval = setInterval(fetchDebugInfo, 2000);
      return () => clearInterval(interval);
    }
  }, [visible, ip]);

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatHeap = (bytes: number): string => {
    return `${Math.floor(bytes / 1024)} KB`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>SYSTEM DEBUG</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {loading && <ActivityIndicator size="large" color={COLORS.accent} />}

          {/* System Info Panel */}
          {systemDebug && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>SYSTEM INFORMATION</Text>
              
              <View style={styles.row}>
                <Text style={styles.label}>Firmware Version:</Text>
                <Text style={styles.value}>{systemDebug.firmware_version}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Build ID:</Text>
                <Text style={styles.value}>{systemDebug.build_id}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Uptime:</Text>
                <Text style={styles.value}>{formatUptime(systemDebug.uptime_ms)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Free Heap:</Text>
                <Text style={styles.value}>{formatHeap(systemDebug.free_heap)}</Text>
              </View>
            </View>
          )}

          {/* DFPlayer Status Panel */}
          {systemDebug && (
            <View style={[styles.panel, systemDebug.dfplayer_available ? styles.panelSuccess : styles.panelError]}>
              <Text style={styles.panelTitle}>DFPLAYER PRO STATUS</Text>
              
              <View style={styles.row}>
                <Text style={styles.label}>Connected:</Text>
                <Text style={[
                  styles.value,
                  { color: systemDebug.dfplayer_available ? COLORS.accent : COLORS.alert }
                ]}>
                  {systemDebug.dfplayer_available ? '✓ YES' : '✗ NO'}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>ADC Initialized:</Text>
                <Text style={[
                  styles.value,
                  { color: systemDebug.adc_initialized ? COLORS.accent : COLORS.alert }
                ]}>
                  {systemDebug.adc_initialized ? '✓ YES' : '✗ NO'}
                </Text>
              </View>

              {!systemDebug.dfplayer_available && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningTitle}>⚠ DFPlayer NOT Connected</Text>
                  <Text style={styles.warningText}>
                    Check:{'\n'}
                    • Power (3.3V/GND){'\n'}
                    • ESP32 GPIO27 → DFPlayer TX{'\n'}
                    • ESP32 GPIO26 → DFPlayer RX{'\n'}
                    • Audio files on SD card{'\n'}
                    • Try power-cycling the module
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Engine Audio Debug Panel */}
          {engineDebug && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>ENGINE AUDIO DEBUG</Text>
              
              <View style={styles.row}>
                <Text style={styles.label}>Throttle (Raw):</Text>
                <Text style={styles.value}>{engineDebug.throttle_raw_us} µs</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Throttle (Normalized):</Text>
                <Text style={styles.value}>{engineDebug.throttle_normalized.toFixed(3)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Throttle (Smoothed):</Text>
                <Text style={styles.value}>{engineDebug.throttle_smoothed.toFixed(3)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Engine Rate:</Text>
                <Text style={styles.value}>{engineDebug.engine_rate.toFixed(3)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Engine Gain:</Text>
                <Text style={styles.value}>{engineDebug.engine_gain.toFixed(3)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Rev Active:</Text>
                <Text style={[
                  styles.value,
                  { color: engineDebug.rev_active ? COLORS.accent : COLORS.secondary }
                ]}>
                  {engineDebug.rev_active ? 'YES' : 'NO'}
                </Text>
              </View>
            </View>
          )}

          {/* Last Update */}
          {lastUpdate && (
            <View style={styles.footerInfo}>
              <Text style={styles.footerText}>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </Text>
              <Text style={styles.footerText}>Auto-refreshing every 2 seconds</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchDebugInfo}>
          <Text style={styles.refreshButtonText}>REFRESH NOW</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    letterSpacing: 2,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  panel: {
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  panelSuccess: {
    borderColor: COLORS.accent,
  },
  panelError: {
    borderColor: COLORS.alert,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    flex: 1,
  },
  value: {
    fontSize: 10,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  warningBox: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    borderWidth: 1,
    borderColor: COLORS.alert,
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
  },
  warningTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.alert,
    fontFamily: FONTS.monospace,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 9,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    lineHeight: 16,
  },
  footerInfo: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 9,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.background,
    fontFamily: FONTS.monospace,
    letterSpacing: 1,
  },
});
