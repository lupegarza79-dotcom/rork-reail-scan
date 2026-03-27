import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (mediaQuery) {
        setReduceMotion(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
        mediaQuery.addEventListener?.('change', handler);
        return () => mediaQuery.removeEventListener?.('change', handler);
      }
      return;
    }

    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}
