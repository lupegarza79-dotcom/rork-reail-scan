import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/colors';
import { AppProvider } from '@/contexts/AppContext';

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

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
