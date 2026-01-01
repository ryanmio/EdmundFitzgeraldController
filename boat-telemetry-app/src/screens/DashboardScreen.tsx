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
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory, File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { getTelemetry, setLED } from '../services/esp32Service';
import { TelemetryResponse } from '../types';
import { COLORS, FONTS } from '../constants/Theme';
import { SystemsCheckModal } from '../components/SystemsCheckModal';
import { useSystemsCheck } from '../hooks/useSystemsCheck';

// Conditionally import FFmpeg (only available in dev builds, not Expo Go)
let FFmpegKit: any = null;
let FFmpegKitConfig: any = null;
try {
  const ffmpeg = require('ffmpeg-kit-react-native');
  FFmpegKit = ffmpeg.FFmpegKit;
  FFmpegKitConfig = ffmpeg.FFmpegKitConfig;
} catch (e) {
  // FFmpeg not available (running in Expo Go)
}

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
  
  return `${hours.toString().padStart(1, '0')}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getSignalBars(rssi: string): number {
  const value = parseInt(rssi.replace('dBm', ''));
  if (value >= -50) return 4;
  if (value >= -60) return 3;
  if (value >= -70) return 2;
  return 1;
}

// Custom Panel Component for the Bridge Console
const ConsolePanel = ({ title, children, style, alert = false }: any) => (
  <View style={[styles.panel, style, alert && styles.panelAlert]}>
    <View style={styles.panelHeader}>
      <View style={styles.panelHeaderDecorator} />
      <Text style={styles.panelTitle}>{title.toUpperCase()}</Text>
    </View>
    <View style={styles.panelContent}>
      {children}
    </View>
  </View>
);

export default function DashboardScreen({ navigation, route }: Props) {
  const { ip, cameraIP: rawCameraIP } = route.params;
  
  const cameraIP = rawCameraIP && rawCameraIP.replace(/^https?:\/\//, '').trim();
  const hasCameraIP = cameraIP && cameraIP.length > 0;
  const streamUrl = hasCameraIP ? `http://${cameraIP}/stream` : null;
  const [cameraLoadError, setCameraLoadError] = useState<string | null>(null);
  
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [togglingRunning, setTogglingRunning] = useState(false);
  const [togglingFlood, setTogglingFlood] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logData, setLogData] = useState<LogEntry[]>([]);
  const [logStartTime, setLogStartTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSystemsCheck, setShowSystemsCheck] = useState(false);
  
  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingFrameCount, setRecordingFrameCount] = useState(0);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const recordingRef = useRef<{ frames: string[]; startTime: number } | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    clockIntervalRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

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
      // Clear stale telemetry data when connection is lost
      setTelemetry(null);
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

  // Systems check hook (must be after toggleLogging is defined)
  const systemsCheck = useSystemsCheck(ip, telemetry, isLogging, toggleLogging);

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

  // Video recording functions
  const stillUrl = hasCameraIP ? `http://${cameraIP}/still` : null;

  const startRecording = async () => {
    if (!stillUrl || Platform.OS === 'web') {
      Alert.alert('Recording Not Available', 'Video recording is only available on mobile devices.');
      return;
    }

    // Request media library permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll access to save recordings.');
      return;
    }

    // Create temp directory for frames using new expo-file-system API
    const framesDirName = `video_frames_${Date.now()}`;
    const framesDir = new Directory(Paths.cache, framesDirName);
    await framesDir.create();

    recordingRef.current = { frames: [], startTime: Date.now() };
    setIsRecording(true);
    setRecordingFrameCount(0);

    debugLog('Video recording started');

    // Capture frames at ~10fps
    recordingIntervalRef.current = setInterval(async () => {
      if (!recordingRef.current || !stillUrl) return;

      try {
        const frameNum = recordingRef.current.frames.length;
        const frameFileName = `frame_${String(frameNum).padStart(6, '0')}.jpg`;
        const frameFile = new File(framesDir, frameFileName);
        
        // Fetch the image and save it
        const response = await fetch(`${stillUrl}?t=${Date.now()}`);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64data = (reader.result as string).split(',')[1];
              await frameFile.write(base64data, { encoding: 'base64' });
              if (recordingRef.current) {
                recordingRef.current.frames.push(frameFile.uri);
                setRecordingFrameCount(recordingRef.current.frames.length);
              }
            } catch (writeErr) {
              debugLog(`Frame write error: ${writeErr}`);
            }
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        // Frame capture failed, skip this frame
        debugLog(`Frame capture error: ${err}`);
      }
    }, 100); // ~10fps
  };

  const stopRecording = async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    setIsRecording(false);

    if (!recordingRef.current || recordingRef.current.frames.length === 0) {
      Alert.alert('Recording Failed', 'No frames were captured.');
      recordingRef.current = null;
      return;
    }

    const frames = recordingRef.current.frames;
    const duration = (Date.now() - recordingRef.current.startTime) / 1000;
    debugLog(`Recording stopped: ${frames.length} frames over ${duration.toFixed(1)}s`);

    setIsProcessingVideo(true);

    try {
      // Get the frames directory from the first frame path
      const framesDirUri = frames[0].substring(0, frames[0].lastIndexOf('/'));
      const framesDir = new Directory(framesDirUri);

      // Check if FFmpeg is available
      if (!FFmpegKit) {
        // FFmpeg not available - save frames as album instead
        debugLog('FFmpeg not available, saving frames as photos');
        
        let savedCount = 0;
        for (const framePath of frames.slice(0, 30)) { // Save first 30 frames max
          try {
            await MediaLibrary.saveToLibraryAsync(framePath);
            savedCount++;
          } catch (err) {
            // Skip failed saves
          }
        }

        // Clean up temp files
        try {
          await framesDir.delete();
        } catch (e) {
          debugLog(`Cleanup error: ${e}`);
        }

        Alert.alert(
          'Frames Saved',
          `Saved ${savedCount} frames to camera roll.\n\nNote: Video encoding requires a development build. Use 'eas build' to enable full video recording.`
        );
      } else {
        // Use FFmpeg to encode video
        const outputFile = new File(Paths.cache, `boat_recording_${Date.now()}.mp4`);
        const fps = Math.round(frames.length / duration);

        const ffmpegCommand = `-framerate ${fps} -i "${framesDirUri}/frame_%06d.jpg" -c:v mpeg4 -q:v 5 -pix_fmt yuv420p "${outputFile.uri}"`;
        
        debugLog(`Running FFmpeg: ${ffmpegCommand}`);

        const session = await FFmpegKit.execute(ffmpegCommand);
        const returnCode = await session.getReturnCode();

        if (returnCode.isValueSuccess()) {
          // Save to camera roll
          await MediaLibrary.saveToLibraryAsync(outputFile.uri);
          
          // Clean up temp files
          try {
            await framesDir.delete();
            await outputFile.delete();
          } catch (e) {
            debugLog(`Cleanup error: ${e}`);
          }

          Alert.alert('Recording Saved', `Video saved to camera roll (${frames.length} frames, ${duration.toFixed(1)}s)`);
          debugLog('Video saved to camera roll');
        } else {
          const logs = await session.getAllLogsAsString();
          debugLog(`FFmpeg failed: ${logs}`);
          Alert.alert('Encoding Failed', 'Could not encode video. Frames have been discarded.');
          
          // Clean up
          try {
            await framesDir.delete();
          } catch (e) {
            debugLog(`Cleanup error: ${e}`);
          }
        }
      }
    } catch (err) {
      debugLog(`Video processing error: ${err}`);
      Alert.alert('Processing Failed', 'Could not process video recording.');
      
      // Clean up temp files
      if (recordingRef.current && recordingRef.current.frames.length > 0) {
        try {
          const framesDirUri = recordingRef.current.frames[0].substring(0, recordingRef.current.frames[0].lastIndexOf('/'));
          const framesDir = new Directory(framesDirUri);
          await framesDir.delete();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } finally {
      setIsProcessingVideo(false);
      recordingRef.current = null;
      setRecordingFrameCount(0);
    }
  };

  const getRecordingDuration = () => {
    if (!recordingRef.current) return '0:00';
    const seconds = Math.floor((Date.now() - recordingRef.current.startTime) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <SystemsCheckModal
        visible={showSystemsCheck}
        onClose={() => setShowSystemsCheck(false)}
        logs={systemsCheck.logs}
        running={systemsCheck.running}
        onRunChecks={systemsCheck.runChecks}
        scrollRef={systemsCheck.scrollRef}
      />

      {/* Connection Lost Banner - positioned above notch */}
      {!isConnected && (
        <SafeAreaView style={styles.safeAreaBanner}>
          <View style={styles.connectionLostBanner}>
            <Text style={styles.connectionLostText}>⚠ CONNECTION LOST</Text>
          </View>
        </SafeAreaView>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.shipName}>S.S. EDMUND FITZGERALD</Text>
          <Text style={styles.bridgeStatus}>BRIDGE CONSOLE ACITVE</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.chronometerContainer}>
            <Text style={styles.chronometerLabel}>SHIP TIME</Text>
            <Text style={styles.chronometer}>
              {currentTime.getHours().toString().padStart(2, '0')}
              {currentTime.getMinutes().toString().padStart(2, '0')}
              <Text style={styles.chronometerSeconds}>
                :{currentTime.getSeconds().toString().padStart(2, '0')}
              </Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.diagButton} onPress={() => setShowSystemsCheck(true)}>
            <View style={styles.diagButtonInner}>
              <Text style={styles.diagIcon}>◈</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.powerButton} onPress={handleDisconnect}>
            <View style={styles.powerButtonInner}>
              <Text style={styles.powerIcon}>⏻</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Row 1: Critical Systems */}
        <View style={styles.panelRow}>
          <ConsolePanel title="Power Station" style={styles.flex1}>
            <View style={styles.gaugeContainer}>
              <View style={styles.analogGauge}>
                <View style={styles.gaugeScale}>
                  {[0, 2, 4, 6, 8, 10, 12, 14, 16].map((v) => (
                    <Text key={v} style={[styles.gaugeMark, { left: `${(v / 16) * 100}%` }]}>
                      {v % 4 === 0 ? v : ''}
                    </Text>
                  ))}
                </View>
                <View style={styles.gaugeTrack} />
                <View 
                  style={[
                    styles.gaugeNeedle, 
                    { left: `${Math.min(100, (parseFloat(telemetry?.battery_voltage || '0') / 16) * 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.gaugeValue}>{telemetry?.battery_voltage || '--.-'}V</Text>
              <Text style={styles.gaugeSublabel}>BATTERY POTENTIAL (0-16V)</Text>
            </View>
          </ConsolePanel>

          <ConsolePanel 
            title="Hull Integrity" 
            style={styles.flex1} 
            alert={telemetry?.water_intrusion}
          >
            <View style={styles.statusDisplay}>
              <Text style={[
                styles.statusLargeText,
                { color: telemetry?.water_intrusion ? COLORS.alert : COLORS.accent }
              ]}>
                {telemetry?.water_intrusion ? 'INTRUSION' : 'SECURE'}
              </Text>
              <View style={[
                styles.statusIndicatorLarge,
                { backgroundColor: telemetry?.water_intrusion ? COLORS.alert : COLORS.accent }
              ]} />
              <Text style={styles.statusSublabel}>BILGE SENSORS ACTIVE</Text>
            </View>
          </ConsolePanel>
        </View>

        {/* Camera Feed */}
        <ConsolePanel title="Visual Feed Relay">
          <View style={styles.cameraContainer}>
            {streamUrl ? (
              <View style={styles.cameraWrapper}>
                {Platform.OS === 'web' ? (
                  <img 
                    src={streamUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                  />
                ) : (
                  <WebView
                    source={{ html: `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                          <style>
                            body { margin: 0; padding: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
                            img { max-width: 100%; max-height: 100%; object-fit: contain; }
                          </style>
                        </head>
                        <body>
                          <img src="${streamUrl}" />
                        </body>
                      </html>
                    ` }}
                    style={styles.cameraStream}
                    scrollEnabled={false}
                    bounces={false}
                    originWhitelist={['*']}
                    mixedContentMode="always"
                    onLoadStart={() => setCameraLoadError(null)}
                    onError={(e) => {
                      const desc = e?.nativeEvent?.description || 'Unknown WebView error';
                      debugLog(`Camera WebView error: ${desc}`);
                      setCameraLoadError(desc);
                    }}
                    onHttpError={(e) => {
                      const code = e?.nativeEvent?.statusCode;
                      const url = e?.nativeEvent?.url;
                      const msg = `HTTP error${code ? ` ${code}` : ''}${url ? ` (${url})` : ''}`;
                      debugLog(`Camera WebView HTTP error: ${msg}`);
                      setCameraLoadError(msg);
                    }}
                  />
                )}
                <View style={styles.cameraOverlay}>
                  <View style={styles.cameraOverlayRow}>
                    <Text style={styles.cameraIPText}>SOURCE: {cameraIP}</Text>
                    {Platform.OS !== 'web' && (
                      <View style={styles.recordButtonContainer}>
                        {isRecording && (
                          <View style={styles.recordingIndicator}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingText}>
                              {recordingFrameCount}f
                            </Text>
                          </View>
                        )}
                        {isProcessingVideo ? (
                          <View style={styles.recordButton}>
                            <ActivityIndicator size="small" color={COLORS.text} />
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                            onPress={isRecording ? stopRecording : startRecording}
                          >
                            {isRecording ? (
                              <View style={styles.stopIcon} />
                            ) : (
                              <View style={styles.recordIcon} />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                {!!cameraLoadError && (
                  <View style={styles.cameraErrorOverlay} pointerEvents="none">
                    <Text style={styles.cameraErrorText}>CAMERA LOAD ERROR</Text>
                    <Text style={styles.cameraErrorTextSmall}>{cameraLoadError}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraText}>NO SIGNAL</Text>
              </View>
            )}
          </View>
        </ConsolePanel>

        {/* Row 2: System Info */}
        <View style={styles.panelRow}>
          <ConsolePanel title="Chronometer" style={styles.flex1}>
            <Text style={styles.telemetryValueLarge}>
              {telemetry ? formatUptime(telemetry.uptime_seconds) : '000:00'}
            </Text>
            <Text style={styles.telemetrySublabel}>OPERATIONAL HOURS</Text>
          </ConsolePanel>

          <ConsolePanel title="Signal Relay" style={styles.flex1}>
            <View style={styles.signalContainer}>
              <View style={styles.signalBars}>
                {[1, 2, 3, 4].map((bar) => (
                  <View
                    key={bar}
                    style={[
                      styles.signalBar,
                      { height: bar * 8 },
                      bar <= signalBars ? styles.signalBarActive : styles.signalBarInactive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.telemetryValue}>
                {telemetry?.signal_strength || '--'}
              </Text>
            </View>
            <Text style={styles.telemetrySublabel}>LINK STRENGTH (dBm)</Text>
          </ConsolePanel>
        </View>

        {/* Row 3: Control Switches */}
        <ConsolePanel title="External Lighting Control">
          <View style={styles.switchRow}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>RUNNING LIGHTS</Text>
              <TouchableOpacity
                style={[
                  styles.industrialSwitch,
                  telemetry?.running_mode_state ? styles.switchOn : styles.switchOff,
                ]}
                onPress={toggleRunningLED}
                disabled={togglingRunning}
              >
                <View style={styles.switchHandle} />
              </TouchableOpacity>
              <View style={[
                styles.ledIndicatorSmall,
                { backgroundColor: telemetry?.running_mode_state ? COLORS.accent : COLORS.ledOff }
              ]} />
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>FLOOD LIGHTS</Text>
              <TouchableOpacity
                style={[
                  styles.industrialSwitch,
                  telemetry?.flood_mode_state ? styles.switchOn : styles.switchOff,
                ]}
                onPress={toggleFloodLED}
                disabled={togglingFlood}
              >
                <View style={styles.switchHandle} />
              </TouchableOpacity>
              <View style={[
                styles.ledIndicatorSmall,
                { backgroundColor: telemetry?.flood_mode_state ? COLORS.text : COLORS.ledOff }
              ]} />
            </View>
          </View>
        </ConsolePanel>

        {/* Data Logging Section */}
        <ConsolePanel title="Data Logger / Recorder">
          <View style={styles.loggingContent}>
            <View style={styles.loggingHeader}>
              <View style={styles.loggingStatus}>
                <View style={[
                  styles.loggingIndicator,
                  { backgroundColor: isLogging ? COLORS.accent : COLORS.ledOff }
                ]} />
                <Text style={styles.loggingStatusText}>
                  {isLogging ? 'RECORDING' : 'READY'}
                </Text>
              </View>
              <View style={styles.loggingStats}>
                <Text style={styles.loggingStatValue}>{logData.length}</Text>
                <Text style={styles.loggingStatLabel}>ENTRIES</Text>
              </View>
            </View>
            
            <View style={styles.loggingButtons}>
              <TouchableOpacity
                style={[styles.consoleButton, isLogging ? styles.buttonStop : styles.buttonStart]}
                onPress={toggleLogging}
              >
                <Text style={styles.consoleButtonText}>
                  {isLogging ? 'STOP REC' : 'START REC'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.consoleButton, styles.buttonSecondary]}
                onPress={exportCSV}
                disabled={logData.length === 0}
              >
                <Text style={styles.consoleButtonText}>EXPORT CSV</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.consoleButton, styles.buttonDanger]}
                onPress={clearLog}
                disabled={logData.length === 0}
              >
                <Text style={styles.consoleButtonText}>CLR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ConsolePanel>

        {/* Status Footer */}
        <View style={styles.statusFooter}>
          <View style={styles.footerDecorator} />
          <Text style={styles.statusLabel}>BRIDGE STATUS:</Text>
          <Text style={[
            styles.statusValue,
            { color: telemetry?.connection_status === 'online' ? COLORS.accent : COLORS.alert }
          ]}>
            {telemetry?.connection_status?.toUpperCase() || 'OFFLINE'}
          </Text>
          <View style={styles.flex1} />
          <Text style={styles.versionText}>SYS_REL_1975_v1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeAreaBanner: {
    backgroundColor: COLORS.alert,
  },
  connectionLostBanner: {
    backgroundColor: COLORS.alert,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  connectionLostText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.background,
    fontFamily: FONTS.monospace,
    letterSpacing: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: COLORS.background,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.secondary,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shipName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    letterSpacing: 1,
  },
  bridgeStatus: {
    fontSize: 10,
    color: COLORS.accent,
    fontFamily: FONTS.monospace,
    marginTop: 2,
  },
  chronometerContainer: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  chronometerLabel: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    marginBottom: 2,
  },
  chronometer: {
    fontSize: 20,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  chronometerSeconds: {
    fontSize: 14,
    color: COLORS.secondary,
  },
  diagButton: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    padding: 2,
    marginRight: 8,
  },
  diagButtonInner: {
    flex: 1,
    backgroundColor: '#3a4b63',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#5a6f8f',
  },
  diagIcon: {
    fontSize: 20,
    color: COLORS.accent,
  },
  powerButton: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    padding: 2,
  },
  powerButtonInner: {
    flex: 1,
    backgroundColor: '#3a4b63',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#5a6f8f',
  },
  powerIcon: {
    fontSize: 20,
    color: COLORS.alert,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  panelRow: {
    flexDirection: 'row',
    gap: 12,
  },
  panel: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  panelAlert: {
    borderColor: COLORS.alert,
    borderWidth: 2,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121926',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  panelHeaderDecorator: {
    width: 3,
    height: 12,
    backgroundColor: COLORS.text,
    marginRight: 8,
  },
  panelTitle: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  panelContent: {
    padding: 12,
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  analogGauge: {
    width: '100%',
    height: 40,
    backgroundColor: '#05070a',
    borderRadius: 2,
    paddingHorizontal: 10,
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  gaugeScale: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    height: 10,
  },
  gaugeMark: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    position: 'absolute',
  },
  gaugeTrack: {
    height: 4,
    backgroundColor: '#1a2332',
    borderRadius: 2,
    marginTop: 12,
  },
  gaugeNeedle: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: COLORS.alert,
    top: 10,
    marginLeft: -1,
    shadowColor: COLORS.alert,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  gaugeValue: {
    fontSize: 24,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  gaugeSublabel: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    marginTop: 2,
  },
  statusDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  statusLargeText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: FONTS.monospace,
    marginBottom: 8,
    letterSpacing: 1,
  },
  statusIndicatorLarge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  statusSublabel: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    marginTop: 10,
  },
  cameraContainer: {
    width: '100%',
  },
  cameraWrapper: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  cameraStream: {
    width: '100%',
    height: '100%',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cameraOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    borderColor: COLORS.alert,
    backgroundColor: 'rgba(255,51,51,0.2)',
  },
  recordIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.alert,
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.alert,
    borderRadius: 2,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.alert,
  },
  recordingText: {
    fontSize: 10,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
  },
  cameraErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(255,0,0,0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  cameraErrorText: {
    fontSize: 10,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cameraErrorTextSmall: {
    fontSize: 9,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
  },
  cameraIPText: {
    fontSize: 10,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
  },
  cameraPlaceholder: {
    aspectRatio: 16 / 9,
    backgroundColor: '#05070a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  cameraText: {
    fontSize: 14,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    letterSpacing: 2,
  },
  telemetryValueLarge: {
    fontSize: 32,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  telemetryValue: {
    fontSize: 20,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  telemetrySublabel: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    textAlign: 'center',
    marginTop: 4,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  signalBar: {
    width: 6,
    backgroundColor: COLORS.ledOff,
  },
  signalBarActive: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  signalBarInactive: {
    backgroundColor: COLORS.ledOff,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  switchContainer: {
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: {
    fontSize: 9,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  industrialSwitch: {
    width: 40,
    height: 70,
    backgroundColor: '#2a3547',
    borderRadius: 4,
    padding: 4,
    borderWidth: 2,
    borderColor: '#1a2332',
  },
  switchOn: {
    justifyContent: 'flex-start',
  },
  switchOff: {
    justifyContent: 'flex-end',
  },
  switchHandle: {
    width: '100%',
    height: '50%',
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#5a6f8f',
  },
  ledIndicatorSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loggingContent: {
    width: '100%',
  },
  loggingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loggingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loggingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loggingStatusText: {
    fontSize: 10,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  loggingStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  loggingStatValue: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  loggingStatLabel: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
  },
  loggingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  consoleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  consoleButtonText: {
    fontSize: 10,
    color: COLORS.background,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  buttonStart: {
    backgroundColor: COLORS.accent,
    borderColor: '#00a843',
  },
  buttonStop: {
    backgroundColor: COLORS.alert,
    borderColor: '#d82c2c',
  },
  buttonSecondary: {
    backgroundColor: COLORS.text,
    borderColor: '#d89600',
  },
  buttonDanger: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.border,
    flex: 0.4,
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  footerDecorator: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.secondary,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    marginRight: 8,
  },
  statusValue: {
    fontSize: 10,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: 8,
    color: COLORS.secondary,
    fontFamily: FONTS.monospace,
    opacity: 0.5,
  },
});


