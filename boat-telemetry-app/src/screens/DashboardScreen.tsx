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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { getTelemetry, setLED } from '../services/esp32Service';
import { TelemetryResponse } from '../types';

type RootStackParamList = {
  Connection: undefined;
  Dashboard: { ip: string };
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
  const { ip } = route.params;
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [togglingRunning, setTogglingRunning] = useState(false);
  const [togglingFlood, setTogglingFlood] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const data = await getTelemetry(ip);
      setTelemetry(data);
      setLastError(null);
      setIsConnected(true);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Connection lost');
      setIsConnected(false);
    }
  }, [ip]);

  useEffect(() => {
    fetchTelemetry();
    intervalRef.current = setInterval(fetchTelemetry, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTelemetry]);

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the boat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            navigation.replace('Connection');
          },
        },
      ]
    );
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
        {/* Camera Feed */}
        <View style={styles.cameraContainer}>
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.cameraText}>Camera Feed</Text>
            <Text style={styles.cameraSubtext}>Awaiting ESP32-CAM hardware</Text>
          </View>
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
  cameraContainer: {
    marginBottom: 20,
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

