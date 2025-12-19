import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { checkConnection } from '../services/esp32Service';
import { saveIP, loadIP, saveCameraIP, loadCameraIP } from '../services/storageService';
import { ConnectionStatus } from '../types';

type RootStackParamList = {
  Connection: undefined;
  Dashboard: { ip: string; cameraIP: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connection'>;
};

export default function ConnectionScreen({ navigation }: Props) {
  const [ip, setIP] = useState('192.168.1.178');
  const [cameraIP, setCameraIP] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load saved IPs on mount
  useEffect(() => {
    loadIP().then((savedIP) => {
      if (savedIP) setIP(savedIP);
    });
    loadCameraIP().then((savedCameraIP) => {
      if (savedCameraIP) setCameraIP(savedCameraIP);
    });
  }, []);

  const handleConnect = async () => {
    if (!ip.trim()) {
      setError('Please enter a telemetry IP address');
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      await checkConnection(ip);
      setStatus('connected');
      await saveIP(ip);
      if (cameraIP.trim()) {
        await saveCameraIP(cameraIP);
      }
      
      // Navigate to dashboard after brief success display
      setTimeout(() => {
        navigation.replace('Dashboard', { ip, cameraIP: cameraIP.trim() });
      }, 500);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connecting':
        return '#F59E0B';
      case 'connected':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected!';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Ready to Connect';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
          <Text style={styles.title}>Edmund Fitzgerald</Text>
          <Text style={styles.subtitle}>Connect to your boat</Text>

          {/* Telemetry IP Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Telemetry ESP32 IP</Text>
            <TextInput
              style={styles.input}
              value={ip}
              onChangeText={setIP}
              placeholder="192.168.1.178"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              editable={status !== 'connecting'}
            />
            <Text style={styles.hint}>Controls, sensors, and LED status</Text>
          </View>

          {/* Camera IP Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Camera ESP32 IP (optional)</Text>
            <TextInput
              style={styles.input}
              value={cameraIP}
              onChangeText={setCameraIP}
              placeholder="192.168.1.xxx"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              editable={status !== 'connecting'}
            />
            <Text style={styles.hint}>Leave empty if no camera connected</Text>
          </View>

          {/* Status Indicator */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Connect Button */}
          <TouchableOpacity
            style={[
              styles.button,
              status === 'connecting' && styles.buttonDisabled,
            ]}
            onPress={handleConnect}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1222',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#1E40AF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
