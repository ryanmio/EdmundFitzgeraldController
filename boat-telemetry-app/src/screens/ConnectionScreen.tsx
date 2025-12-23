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
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { checkConnection } from '../services/esp32Service';
import { saveIP, loadIP, saveCameraIP, loadCameraIP } from '../services/storageService';
import { ConnectionStatus } from '../types';
import { COLORS, FONTS } from '../constants/Theme';

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
      setError('PLEASE ENTER TELEMETRY IP');
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
      }, 800);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message.toUpperCase() : 'CONNECTION FAILED');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connecting':
        return COLORS.text;
      case 'connected':
        return COLORS.accent;
      case 'failed':
        return COLORS.alert;
      default:
        return COLORS.secondary;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return '> ESTABLISHING LINK...';
      case 'connected':
        return '> CONNECTION SECURE';
      case 'failed':
        return '> LINK FAILURE';
      default:
        return '> SYSTEM READY';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.scanlines} pointerEvents="none" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
        <View style={styles.shipLogoContainer}>
          <Image 
            source={require('../../assets/boat.png')} 
            style={styles.boatImage}
            resizeMode="contain"
          />
        </View>
          
          <Text style={styles.title}>EDMUND FITZGERALD</Text>
          <Text style={styles.subtitle}>BRIDGE CONSOLE v1.0 [1975]</Text>

          {/* Telemetry IP Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <View style={styles.labelDecorator} />
              <Text style={styles.label}>TELEMETRY ESP32 IP</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={ip}
                onChangeText={setIP}
                placeholder="000.000.0.000"
                placeholderTextColor="#4a5f7f"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
                editable={status !== 'connecting'}
              />
            </View>
            <Text style={styles.hint}>PRIMARY SENSOR INTERFACE</Text>
          </View>

          {/* Camera IP Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <View style={styles.labelDecorator} />
              <Text style={styles.label}>CAMERA ESP32 IP (OPTIONAL)</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={cameraIP}
                onChangeText={setCameraIP}
                placeholder="000.000.0.000"
                placeholderTextColor="#4a5f7f"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
                editable={status !== 'connecting'}
              />
            </View>
            <Text style={styles.hint}>VISUAL FEED RELAY</Text>
          </View>

          {/* Status Indicator */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusLED, { 
              backgroundColor: getStatusColor(),
              shadowColor: getStatusColor(),
              shadowOpacity: status !== 'idle' ? 0.8 : 0.3,
            }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>[!] ERROR: {error}</Text>
            </View>
          )}

          {/* Connect Button */}
          <TouchableOpacity
            style={[
              styles.button,
              status === 'connecting' && styles.buttonDisabled,
            ]}
            onPress={handleConnect}
            disabled={status === 'connecting'}
            activeOpacity={0.8}
          >
            {status === 'connecting' ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.buttonText}>INITIALIZE CONNECTION</Text>
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
    backgroundColor: COLORS.background,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 999,
    // Note: True scanlines would need a repeating linear gradient or an image
    // For now, we'll use a very subtle overlay
    opacity: 0.05,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  shipLogoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    height: 80,
    justifyContent: 'center',
  },
  boatImage: {
    width: '80%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: FONTS.monospace,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: FONTS.monospace,
    letterSpacing: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelDecorator: {
    width: 4,
    height: 14,
    backgroundColor: COLORS.text,
    marginRight: 8,
  },
  label: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  inputWrapper: {
    backgroundColor: '#05070a',
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 4,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.text,
  },
  input: {
    paddingVertical: 12,
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
  },
  hint: {
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: 6,
    fontFamily: FONTS.monospace,
    textAlign: 'right',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 24,
    backgroundColor: '#05070a',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1a2332',
  },
  statusLED: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 14,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    padding: 12,
    borderRadius: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.alert,
  },
  errorText: {
    color: COLORS.alert,
    textAlign: 'left',
    fontSize: 12,
    fontFamily: FONTS.monospace,
  },
  button: {
    backgroundColor: COLORS.text,
    borderRadius: 4,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.monospace,
    letterSpacing: 1,
  },
});

