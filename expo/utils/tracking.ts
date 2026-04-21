import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REF_TOKEN_KEY = 'ref_token';
const FIRST_VISIT_KEY = 'first_visit_timestamp';

export async function setStored(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (err) {
    console.log('[tracking] setStored error:', err);
  }
}

export async function getStored(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
    return await AsyncStorage.getItem(key);
  } catch (err) {
    console.log('[tracking] getStored error:', err);
    return null;
  }
}

export async function captureRefFromUrl(): Promise<void> {
  try {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      await setStored(REF_TOKEN_KEY, ref);
      console.log('[tracking] Captured ref_token:', ref);
    }
    const existing = await getStored(FIRST_VISIT_KEY);
    if (!existing) {
      const ts = Date.now().toString();
      await setStored(FIRST_VISIT_KEY, ts);
      console.log('[tracking] First visit:', ts);
    }
  } catch (err) {
    console.log('[tracking] captureRefFromUrl error:', err);
  }
}

export async function getRefToken(): Promise<string | null> {
  return getStored(REF_TOKEN_KEY);
}
