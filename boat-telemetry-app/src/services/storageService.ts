// AsyncStorage service for IP persistence
import AsyncStorage from '@react-native-async-storage/async-storage';

const IP_STORAGE_KEY = '@boat_telemetry_ip';
const CAMERA_IP_STORAGE_KEY = '@boat_camera_ip';

/**
 * Save telemetry IP address to storage
 */
export async function saveIP(ip: string): Promise<void> {
  try {
    await AsyncStorage.setItem(IP_STORAGE_KEY, ip);
  } catch (error) {
    console.error('Failed to save IP:', error);
  }
}

/**
 * Load telemetry IP address from storage
 */
export async function loadIP(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(IP_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load IP:', error);
    return null;
  }
}

/**
 * Save camera IP address to storage
 */
export async function saveCameraIP(ip: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CAMERA_IP_STORAGE_KEY, ip);
  } catch (error) {
    console.error('Failed to save camera IP:', error);
  }
}

/**
 * Load camera IP address from storage
 */
export async function loadCameraIP(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CAMERA_IP_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load camera IP:', error);
    return null;
  }
}

