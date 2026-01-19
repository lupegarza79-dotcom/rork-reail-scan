import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REVIEW_STORAGE_KEY = 'reail_store_review';
const MIN_SCANS_BEFORE_REVIEW = 3;
const DAYS_BETWEEN_PROMPTS = 30;

interface ReviewState {
  lastPromptDate: number | null;
  scanCount: number;
  hasReviewed: boolean;
}

async function getReviewState(): Promise<ReviewState> {
  try {
    const stored = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.log('[StoreReview] Error reading state:', error);
  }
  return {
    lastPromptDate: null,
    scanCount: 0,
    hasReviewed: false,
  };
}

async function saveReviewState(state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.log('[StoreReview] Error saving state:', error);
  }
}

export async function incrementScanCount(): Promise<void> {
  const state = await getReviewState();
  state.scanCount += 1;
  await saveReviewState(state);
}

export async function shouldRequestReview(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const state = await getReviewState();

  if (state.hasReviewed) {
    console.log('[StoreReview] User already reviewed');
    return false;
  }

  if (state.scanCount < MIN_SCANS_BEFORE_REVIEW) {
    console.log('[StoreReview] Not enough scans:', state.scanCount);
    return false;
  }

  if (state.lastPromptDate) {
    const daysSinceLastPrompt = (Date.now() - state.lastPromptDate) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < DAYS_BETWEEN_PROMPTS) {
      console.log('[StoreReview] Too soon since last prompt:', daysSinceLastPrompt, 'days');
      return false;
    }
  }

  return true;
}

export async function requestReview(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      console.log('[StoreReview] Not available on web');
      return false;
    }

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      console.log('[StoreReview] Not available on this device');
      return false;
    }

    const shouldRequest = await shouldRequestReview();
    if (!shouldRequest) {
      return false;
    }

    console.log('[StoreReview] Requesting review...');
    await StoreReview.requestReview();

    const state = await getReviewState();
    state.lastPromptDate = Date.now();
    await saveReviewState(state);

    return true;
  } catch (error) {
    console.log('[StoreReview] Error requesting review:', error);
    return false;
  }
}

export async function markAsReviewed(): Promise<void> {
  const state = await getReviewState();
  state.hasReviewed = true;
  await saveReviewState(state);
}

export async function maybeRequestReviewAfterScan(badge: string): Promise<void> {
  await incrementScanCount();
  
  if (badge === 'VERIFIED') {
    const shouldRequest = await shouldRequestReview();
    if (shouldRequest) {
      setTimeout(() => {
        requestReview();
      }, 2000);
    }
  }
}
