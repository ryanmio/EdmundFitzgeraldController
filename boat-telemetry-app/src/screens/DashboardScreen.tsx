import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Share,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTelemetry, setLED } from '../services/esp32Service';
import { TelemetryResponse } from '../types';

interface LogEntry extends TelemetryResponse {
  log_timestamp: string;
}

const LOG_STORAGE_KEY = '@boat_telemetry_log';
const LOG_STATE_KEY = '@boat_telemetry_log_state';

function debugLog(message: string) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${message}`;
  console.log(msg);
  if (Platform.OS === 'web') {
    // Also log to browser console
    (window as any).debugLogs = (window as any).debugLogs || [];
    (window as any).debugLogs.push(msg);
  }
}

type RootStackParamList = {
  Connection: undefined;
  Dashboard: { ip: string; cameraIP: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
  route: RouteProp<RootStackParamList, 'Dashboard'>;
};

const { width } = Dimensions.get('window');

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function getSignalBars(rssi: string): number {
  const value = parseInt(rssi.replace('dBm', ''));
  if (value >= -50) return 4;
  if (value >= -60) return 3;
  if (value >= -70) return 2;
  return 1;
}

export default function DashboardScreen({ navigation, route }: Props) {
  const { ip, cameraIP: rawCameraIP } = route.params;
  
  // Clean camera IP (remove http:// prefix if user added it)
  const cameraIP = rawCameraIP && rawCameraIP.replace(/^https?:\/\//, '').trim();
  const hasCameraIP = cameraIP && cameraIP.length > 0;
  const streamUrl = hasCameraIP ? `http://${cameraIP}/stream` : null;
  
  debugLog(`Dashboard initialized - Telemetry IP: ${ip}, Camera IP: ${cameraIP}, Stream URL: ${streamUrl}`);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [togglingRunning, setTogglingRunning] = useState(false);
  const [togglingFlood, setTogglingFlood] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logData, setLogData] = useState<LogEntry[]>([]);
  const [logStartTime, setLogStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved log data on mount
  useEffect(() => {
    const loadSavedLog = async () => {
      try {
        const savedLog = await AsyncStorage.getItem(LOG_STORAGE_KEY);
        const savedState = await AsyncStorage.getItem(LOG_STATE_KEY);
        
        if (savedLog) {
          const parsed = JSON.parse(savedLog);
          setLogData(parsed);
        }
        if (savedState) {
          const state = JSON.parse(savedState);
          if (state.isLogging) {
            setIsLogging(true);
            setLogStartTime(new Date(state.startTime));
          }
        }
      } catch (err) {
        console.log('Failed to load saved log:', err);
      }
    };
    loadSavedLog();
  }, []);

  // Save log data periodically (debounced to avoid too many writes)
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logData));
        await AsyncStorage.setItem(LOG_STATE_KEY, JSON.stringify({
          isLogging,
          startTime: logStartTime?.toISOString(),
        }));
      } catch (err) {
        console.log('Failed to save log:', err);
      }
    }, 2000); // Save every 2 seconds max
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [logData, isLogging, logStartTime]);

  const fetchTelemetry = useCallback(async () => {
    try {
      const data = await getTelemetry(ip);
      setTelemetry(data);
      setLastError(null);
      setIsConnected(true);
      
      // Log data if logging is enabled
      if (isLogging) {
        const entry: LogEntry = {
          ...data,
          log_timestamp: new Date().toISOString(),
        };
        setLogData(prev => [...prev, entry]);
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Connection lost');
      setIsConnected(false);
    }
  }, [ip, isLogging]);

  useEffect(() => {
    fetchTelemetry();
    intervalRef.current = setInterval(fetchTelemetry, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTelemetry]);

  const handleDisconnect = () => {
    const confirmDisconnect = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      navigation.replace('Connection');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Disconnect from the boat? You\'ll need to reconnect from the home screen.')) {
        confirmDisconnect();
      }
    } else {
      Alert.alert(
        'Disconnect',
        'Are you sure you want to disconnect from the boat?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: confirmDisconnect,
          },
        ]
      );
    }
  };

  const toggleRunningLED = async () => {
    if (!telemetry || togglingRunning) return;
    setTogglingRunning(true);
    try {
      const newState = !telemetry.running_mode_state;
      await setLED(ip, 'running', newState ? 'on' : 'off');
      setTelemetry({ ...telemetry, running_mode_state: newState });
    } catch (err) {
      Alert.alert('Error', 'Failed to toggle running light');
    } finally {
      setTogglingRunning(false);
    }
  };

  const toggleFloodLED = async () => {
    if (!telemetry || togglingFlood) return;
    setTogglingFlood(true);
    try {
      const newState = !telemetry.flood_mode_state;
      await setLED(ip, 'flood', newState ? 'on' : 'off');
      setTelemetry({ ...telemetry, flood_mode_state: newState });
    } catch (err) {
      Alert.alert('Error', 'Failed to toggle flood light');
    } finally {
      setTogglingFlood(false);
    }
  };

  const signalBars = telemetry ? getSignalBars(telemetry.signal_strength) : 0;

  const toggleLogging = () => {
    if (isLogging) {
      setIsLogging(false);
    } else {
      setIsLogging(true);
      setLogStartTime(new Date());
    }
  };

  const clearLog = async () => {
    const doClear = async () => {
      setLogData([]);
      setLogStartTime(null);
      setIsLogging(false);
      try {
        await AsyncStorage.removeItem(LOG_STORAGE_KEY);
        await AsyncStorage.removeItem(LOG_STATE_KEY);
      } catch (err) {
        console.log('Failed to clear storage:', err);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Clear ${logData.length} log entries?`)) {
        await doClear();
      }
    } else {
      Alert.alert('Clear Log', `Clear ${logData.length} log entries?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doClear },
      ]);
    }
  };

  const exportCSV = async () => {
    if (logData.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('No data to export. Start logging first.');
      } else {
        Alert.alert('No Data', 'No data to export. Start logging first.');
      }
      return;
    }

    // Build CSV content
    const headers = [
      'log_timestamp',
      'esp_timestamp',
      'battery_voltage',
      'signal_strength',
      'uptime_seconds',
      'running_led',
      'flood_led',
      'water_intrusion',
      'water_sensor_raw',
      'connection_status',
      'ip_address',
    ];
    
    const rows = logData.map(entry => [
      entry.log_timestamp,
      entry.timestamp,
      entry.battery_voltage,
      entry.signal_strength,
      entry.uptime_seconds,
      entry.running_mode_state ? '1' : '0',
      entry.flood_mode_state ? '1' : '0',
      entry.water_intrusion ? '1' : '0',
      entry.water_sensor_raw,
      entry.connection_status,
      entry.ip_address,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `boat_telemetry_${new Date().toISOString().slice(0, 10)}.csv`;

    if (Platform.OS === 'web') {
      // Web: download as file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Native: use Share
      try {
        await Share.share({
          message: csv,
          title: filename,
        });
      } catch (err) {
        Alert.alert('Export Failed', 'Could not export data');
      }
    }
  };

  const getLogDuration = () => {
    if (!logStartTime) return '--';
    const seconds = Math.floor((Date.now() - logStartTime.getTime()) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Edmund Fitzgerald</Text>
          <View style={styles.connectionInfo}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.ipText}>{ip}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>⏻</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {lastError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{lastError}</Text>
        </View>
      )}

      {/* Water Intrusion Alert */}
      {telemetry?.water_intrusion && (
        <View style={styles.waterAlert}>
          <Text style={styles.waterAlertIcon}>🚨</Text>
          <Text style={styles.waterAlertText}>WATER INTRUSION DETECTED!</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Debug Info (web only) */}
        {Platform.OS === 'web' && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugTitle}>📡 Debug Info</Text>
            <Text style={styles.debugText}>Telemetry: {ip}</Text>
            <Text style={styles.debugText}>Camera: {cameraIP || 'None'}</Text>
            <Text style={styles.debugText}>Stream URL: {streamUrl || 'N/A'}</Text>
          </View>
        )}
        {/* Camera Feed */}
        <View style={styles.cameraContainer}>
          {streamUrl ? (
            <View style={styles.cameraWrapper}>
              {Platform.OS === 'web' ? (
                <img 
                  src={streamUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                />
              ) : (
                <Image
                  source={{ uri: streamUrl }}
                  style={styles.cameraStream}
                  resizeMode="contain"
                />
              )}
              <View style={styles.cameraOverlay}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text style={styles.cameraIPText}>{cameraIP}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraText}>No Camera Connected</Text>
              <Text style={styles.cameraSubtext}>Add Camera IP on connection screen</Text>
            </View>
          )}
        </View>

        {/* LED Controls */}
        <Text style={styles.sectionTitle}>Lights</Text>
        <View style={styles.ledRow}>
          <TouchableOpacity
            style={[
              styles.ledCard,
              telemetry?.running_mode_state ? styles.ledCardOn : styles.ledCardOff,
            ]}
            onPress={toggleRunningLED}
            disabled={togglingRunning}
            activeOpacity={0.7}
          >
            {togglingRunning ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.ledIcon}>💡</Text>
                <Text style={styles.ledLabel}>Running</Text>
                <View style={[
                  styles.ledIndicator,
                  { backgroundColor: telemetry?.running_mode_state ? '#10B981' : '#4B5563' }
                ]} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ledCard,
              telemetry?.flood_mode_state ? styles.ledCardOn : styles.ledCardOff,
            ]}
            onPress={toggleFloodLED}
            disabled={togglingFlood}
            activeOpacity={0.7}
          >
            {togglingFlood ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.ledIcon}>🔦</Text>
                <Text style={styles.ledLabel}>Flood</Text>
                <View style={[
                  styles.ledIndicator,
                  { backgroundColor: telemetry?.flood_mode_state ? '#F59E0B' : '#4B5563' }
                ]} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Telemetry Grid */}
        <Text style={styles.sectionTitle}>Telemetry</Text>
        <View style={styles.telemetryGrid}>
          {/* Battery */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryIcon}>🔋</Text>
            <Text style={styles.telemetryLabel}>Battery</Text>
            <Text style={styles.telemetryValue}>
              {telemetry?.battery_voltage || '--'}
            </Text>
          </View>

          {/* Signal */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryIcon}>📶</Text>
            <Text style={styles.telemetryLabel}>Signal</Text>
            <View style={styles.signalBars}>
              {[1, 2, 3, 4].map((bar) => (
                <View
                  key={bar}
                  style={[
                    styles.signalBar,
                    { height: bar * 6 },
                    bar <= signalBars ? styles.signalBarActive : styles.signalBarInactive,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.telemetrySubvalue}>
              {telemetry?.signal_strength || '--'}
            </Text>
          </View>

          {/* Uptime */}
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryIcon}>⏱️</Text>
            <Text style={styles.telemetryLabel}>Uptime</Text>
            <Text style={styles.telemetryValue}>
              {telemetry ? formatUptime(telemetry.uptime_seconds) : '--'}
            </Text>
          </View>

          {/* Water Sensor */}
          <View style={[
            styles.telemetryCard,
            telemetry?.water_intrusion && styles.telemetryCardAlert
          ]}>
            <Text style={styles.telemetryIcon}>💧</Text>
            <Text style={styles.telemetryLabel}>Hull</Text>
            <Text style={[
              styles.telemetryValue,
              { color: telemetry?.water_intrusion ? '#EF4444' : '#10B981' }
            ]}>
              {telemetry?.water_intrusion ? 'WET' : 'DRY'}
            </Text>
          </View>
        </View>

        {/* Data Logging Section */}
        <Text style={styles.sectionTitle}>Data Logging</Text>
        <View style={styles.loggingCard}>
          <View style={styles.loggingHeader}>
            <View style={styles.loggingStatus}>
              <View style={[
                styles.loggingIndicator,
                { backgroundColor: isLogging ? '#10B981' : '#4B5563' }
              ]} />
              <Text style={styles.loggingStatusText}>
                {isLogging ? 'Recording' : 'Stopped'}
              </Text>
            </View>
            <View style={styles.loggingStats}>
              <Text style={styles.loggingStatValue}>{logData.length}</Text>
              <Text style={styles.loggingStatLabel}>entries</Text>
            </View>
            <View style={styles.loggingStats}>
              <Text style={styles.loggingStatValue}>{getLogDuration()}</Text>
              <Text style={styles.loggingStatLabel}>duration</Text>
            </View>
          </View>
          
          <View style={styles.loggingButtons}>
            <TouchableOpacity
              style={[
                styles.loggingBtn,
                isLogging ? styles.loggingBtnStop : styles.loggingBtnStart,
              ]}
              onPress={toggleLogging}
            >
              <Text style={styles.loggingBtnText}>
                {isLogging ? '⏹ Stop' : '⏺ Record'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.loggingBtn, styles.loggingBtnExport]}
              onPress={exportCSV}
              disabled={logData.length === 0}
            >
              <Text style={[
                styles.loggingBtnText,
                logData.length === 0 && styles.loggingBtnTextDisabled
              ]}>
                📤 Export CSV
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.loggingBtn, styles.loggingBtnClear]}
              onPress={clearLog}
              disabled={logData.length === 0}
            >
              <Text style={[
                styles.loggingBtnText,
                logData.length === 0 && styles.loggingBtnTextDisabled
              ]}>
                🗑️
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Footer */}
        <View style={styles.statusFooter}>
          <Text style={styles.statusLabel}>ESP32 Status:</Text>
          <Text style={[
            styles.statusValue,
            { color: telemetry?.connection_status === 'online' ? '#10B981' : '#EF4444' }
          ]}>
            {telemetry?.connection_status?.toUpperCase() || 'UNKNOWN'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1222',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#141E30',
    borderBottomWidth: 1,
    borderBottomColor: '#243447',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  ipText: {
    fontSize: 13,
    color: '#8892A6',
    fontFamily: 'monospace',
  },
  disconnectBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  disconnectText: {
    fontSize: 20,
    color: '#94A3B8',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F1D1D',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '500',
  },
  waterAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  waterAlertIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  waterAlertText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  debugPanel: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  cameraContainer: {
    marginBottom: 20,
  },
  cameraWrapper: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraStream: {
    width: '100%',
    height: '100%',
  },
  cameraStreamWeb: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000000',
  },
  cameraIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  cameraIPText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    opacity: 0.8,
  },
  cameraPlaceholder: {
    aspectRatio: 16 / 9,
    backgroundColor: '#1A2332',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#243447',
    borderStyle: 'dashed',
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  cameraText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  cameraSubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  ledRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  ledCard: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  ledCardOn: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  ledCardOff: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  ledIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  ledLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  ledIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  telemetryCard: {
    width: (width - 44) / 2,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  telemetryCardAlert: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
  },
  telemetryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  telemetryLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  telemetryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  telemetrySubvalue: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginBottom: 4,
  },
  signalBar: {
    width: 6,
    borderRadius: 2,
  },
  signalBarActive: {
    backgroundColor: '#10B981',
  },
  signalBarInactive: {
    backgroundColor: '#374151',
  },
  loggingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  loggingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  loggingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loggingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  loggingStatusText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  loggingStats: {
    alignItems: 'center',
  },
  loggingStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loggingStatLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  loggingButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  loggingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggingBtnStart: {
    backgroundColor: '#065F46',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  loggingBtnStop: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  loggingBtnExport: {
    backgroundColor: '#1E40AF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  loggingBtnClear: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    flex: 0.4,
  },
  loggingBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loggingBtnTextDisabled: {
    opacity: 0.4,
  },
  statusFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#243447',
    marginTop: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#64748B',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});

