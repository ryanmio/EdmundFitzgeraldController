import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { setLED, getTelemetry } from '../services/esp32Service';

type RootStackParamList = {
  Connection: undefined;
  Telemetry: { ip: string };
  LEDControl: { ip: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LEDControl'>;
  route: RouteProp<RootStackParamList, 'LEDControl'>;
};

export default function LEDControlScreen({ navigation, route }: Props) {
  const { ip } = route.params;
  const [runningLED, setRunningLED] = useState(false);
  const [floodLED, setFloodLED] = useState(false);
  const [loadingRunning, setLoadingRunning] = useState(false);
  const [loadingFlood, setLoadingFlood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current LED states on mount
  const fetchCurrentState = useCallback(async () => {
    try {
      const data = await getTelemetry(ip);
      setRunningLED(data.running_mode_state);
      setFloodLED(data.flood_mode_state);
    } catch (err) {
      setError('Failed to fetch LED states');
    }
  }, [ip]);

  useEffect(() => {
    fetchCurrentState();
  }, [fetchCurrentState]);

  const toggleRunningLED = async () => {
    setLoadingRunning(true);
    setError(null);
    try {
      const newState = !runningLED;
      await setLED(ip, 'running', newState ? 'on' : 'off');
      setRunningLED(newState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle LED');
    } finally {
      setLoadingRunning(false);
    }
  };

  const toggleFloodLED = async () => {
    setLoadingFlood(true);
    setError(null);
    try {
      const newState = !floodLED;
      await setLED(ip, 'flood', newState ? 'on' : 'off');
      setFloodLED(newState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle LED');
    } finally {
      setLoadingFlood(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>LED Control</Text>
        <Text style={styles.ipText}>{ip}</Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* LED Controls */}
      <View style={styles.content}>
        {/* Running LED Toggle */}
        <TouchableOpacity
          style={[
            styles.ledButton,
            runningLED ? styles.ledButtonOn : styles.ledButtonOff,
          ]}
          onPress={toggleRunningLED}
          disabled={loadingRunning}
        >
          {loadingRunning ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <>
              <Text style={styles.ledLabel}>Running Light</Text>
              <View style={[
                styles.ledIndicator,
                { backgroundColor: runningLED ? '#10B981' : '#374151' }
              ]} />
              <Text style={styles.ledState}>
                {runningLED ? 'ON' : 'OFF'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Flood LED Toggle */}
        <TouchableOpacity
          style={[
            styles.ledButton,
            floodLED ? styles.ledButtonOn : styles.ledButtonOff,
          ]}
          onPress={toggleFloodLED}
          disabled={loadingFlood}
        >
          {loadingFlood ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <>
              <Text style={styles.ledLabel}>Flood Light</Text>
              <View style={[
                styles.ledIndicator,
                { backgroundColor: floodLED ? '#F59E0B' : '#374151' }
              ]} />
              <Text style={styles.ledState}>
                {floodLED ? 'ON' : 'OFF'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info */}
        <Text style={styles.infoText}>
          Tap a button to toggle the LED state.
          Changes are sent immediately to the ESP32.
        </Text>
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
  backButton: {
    fontSize: 16,
    color: '#3B82F6',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
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
    padding: 24,
    justifyContent: 'center',
  },
  ledButton: {
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
  },
  ledButtonOn: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  ledButtonOff: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  ledLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  ledIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 16,
  },
  ledState: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});

