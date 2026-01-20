import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/colors';
import { AppProvider } from '@/contexts/AppContext';
import { getInitialUrl, addUrlListener, parseScanIdFromUrl } from '@/utils/deepLinking';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen 
        name="scanning" 
        options={{ 
          animation: 'fade',
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="result" 
        options={{ 
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen 
        name="settings" 
        options={{ 
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="share-tutorial" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function DeepLinkHandler() {
  const router = useRouter();

  const handleDeepLink = useCallback((url: string | null) => {
    if (!url) return;
    
    console.log('[DeepLink] Received URL:', url);
    
    const scanId = parseScanIdFromUrl(url);
    if (scanId) {
      console.log('[DeepLink] Navigating to result with scanId:', scanId);
      router.push({ pathname: '/result', params: { scanId } });
      return;
    }

    const urlMatch = url.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const sharedUrl = urlMatch[0];
      console.log('[DeepLink] Share-to-Scan detected, URL:', sharedUrl);
      router.push({ pathname: '/scanning', params: { url: sharedUrl } });
    }
  }, [router]);

  useEffect(() => {
    getInitialUrl().then(handleDeepLink);
    const unsubscribe = addUrlListener(handleDeepLink);
    return unsubscribe;
  }, [handleDeepLink]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <DeepLinkHandler />
          <StatusBar style="light" />
          <RootLayoutNav />
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
