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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { checkConnection } from '../services/esp32Service';
import { saveIP, loadIP } from '../services/storageService';
import { ConnectionStatus } from '../types';

type RootStackParamList = {
  Connection: undefined;
  Dashboard: { ip: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connection'>;
};

export default function ConnectionScreen({ navigation }: Props) {
  const [ip, setIP] = useState('172.20.10.4');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load saved IP on mount
  useEffect(() => {
    loadIP().then((savedIP) => {
      if (savedIP) {
        setIP(savedIP);
      }
    });
  }, []);

  const handleConnect = async () => {
    if (!ip.trim()) {
      setError('Please enter an IP address');
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      await checkConnection(ip);
      setStatus('connected');
      await saveIP(ip);
      
      // Navigate to dashboard after brief success display
      setTimeout(() => {
        navigation.replace('Dashboard', { ip });
      }, 500);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connecting':
        return '#F59E0B'; // amber
      case 'connected':
        return '#10B981'; // green
      case 'failed':
        return '#EF4444'; // red
      default:
        return '#6B7280'; // gray
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
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Boat Telemetry</Text>
        <Text style={styles.subtitle}>Connect to your ESP32</Text>

        {/* IP Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>ESP32 IP Address</Text>
          <TextInput
            style={styles.input}
            value={ip}
            onChangeText={setIP}
            placeholder="172.20.10.4"
            placeholderTextColor="#6B7280"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
            editable={status !== 'connecting'}
          />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark navy
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 48,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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

