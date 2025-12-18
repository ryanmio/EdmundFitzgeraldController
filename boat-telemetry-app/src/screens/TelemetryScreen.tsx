import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { getTelemetry } from '../services/esp32Service';
import { TelemetryResponse } from '../types';

type RootStackParamList = {
  Connection: undefined;
  Telemetry: { ip: string };
  LEDControl: { ip: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Telemetry'>;
  route: RouteProp<RootStackParamList, 'Telemetry'>;
};

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

export default function TelemetryScreen({ navigation, route }: Props) {
  const { ip } = route.params;
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const data = await getTelemetry(ip);
      setTelemetry(data);
      setLastError(null);
      setIsConnected(true);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Fetch failed');
      setIsConnected(false);
    }
  }, [ip]);

  // Start polling on mount
  useEffect(() => {
    fetchTelemetry(); // Initial fetch
    intervalRef.current = setInterval(fetchTelemetry, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTelemetry]);

  const handleDisconnect = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    navigation.replace('Connection');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Telemetry</Text>
        <View style={styles.connectionStatus}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isConnected ? '#10B981' : '#EF4444' }
          ]} />
          <Text style={styles.ipText}>{ip}</Text>
        </View>
      </View>

      {/* Error Banner */}
      {lastError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Connection issue: {lastError}</Text>
        </View>
      )}

      {/* Telemetry Cards */}
      <ScrollView style={styles.content} contentContainerStyle={styles.cardsContainer}>
        {/* Battery Voltage */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Battery Voltage</Text>
          <Text style={styles.cardValue}>
            {telemetry?.battery_voltage || '--'}
          </Text>
        </View>

        {/* Signal Strength */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Signal Strength</Text>
          <Text style={styles.cardValue}>
            {telemetry?.signal_strength || '--'}
          </Text>
        </View>

        {/* Uptime */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Uptime</Text>
          <Text style={styles.cardValue}>
            {telemetry ? formatUptime(telemetry.uptime_seconds) : '--'}
          </Text>
        </View>

        {/* Connection Status */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ESP32 Status</Text>
          <Text style={[
            styles.cardValue,
            { color: telemetry?.connection_status === 'online' ? '#10B981' : '#EF4444' }
          ]}>
            {telemetry?.connection_status?.toUpperCase() || '--'}
          </Text>
        </View>

        {/* LED States */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Running LED</Text>
          <Text style={[
            styles.cardValue,
            { color: telemetry?.running_mode_state ? '#10B981' : '#6B7280' }
          ]}>
            {telemetry?.running_mode_state ? 'ON' : 'OFF'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Flood LED</Text>
          <Text style={[
            styles.cardValue,
            { color: telemetry?.flood_mode_state ? '#10B981' : '#6B7280' }
          ]}>
            {telemetry?.flood_mode_state ? 'ON' : 'OFF'}
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.navigate('LEDControl', { ip })}
        >
          <Text style={styles.controlButtonText}>LED Control</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
        >
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  ipText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    padding: 12,
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'center',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  cardsContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  controlButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
  },
});

