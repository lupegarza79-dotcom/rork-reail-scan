import { useState, useEffect, useCallback } from 'react';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: Network.NetworkStateType | null;
}

export function useNetwork() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: null,
  });

  const checkNetwork = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        setNetworkState({
          isConnected: navigator.onLine,
          isInternetReachable: navigator.onLine,
          type: null,
        });
        return;
      }

      const state = await Network.getNetworkStateAsync();
      console.log('[useNetwork] Network state:', state);
      
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? null,
        type: state.type ?? null,
      });
    } catch (error) {
      console.log('[useNetwork] Error checking network:', error);
      setNetworkState({
        isConnected: true,
        isInternetReachable: true,
        type: null,
      });
    }
  }, []);

  useEffect(() => {
    checkNetwork();

    if (Platform.OS === 'web') {
      const handleOnline = () => setNetworkState(prev => ({ ...prev, isConnected: true, isInternetReachable: true }));
      const handleOffline = () => setNetworkState(prev => ({ ...prev, isConnected: false, isInternetReachable: false }));
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [checkNetwork]);

  return {
    ...networkState,
    refresh: checkNetwork,
  };
}
