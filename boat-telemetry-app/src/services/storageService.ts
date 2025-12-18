// AsyncStorage service for IP persistence
import AsyncStorage from '@react-native-async-storage/async-storage';

const IP_STORAGE_KEY = '@boat_telemetry_ip';

/**
 * Save IP address to storage
 */
export async function saveIP(ip: string): Promise<void> {
  try {
    await AsyncStorage.setItem(IP_STORAGE_KEY, ip);
  } catch (error) {
    console.error('Failed to save IP:', error);
  }
}

/**
 * Load IP address from storage
 */
export async function loadIP(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(IP_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load IP:', error);
    return null;
  }
}

