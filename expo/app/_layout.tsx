import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts as useIBM, IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_700Bold } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts as useSerif, InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { captureRefFromUrl } from "@/utils/tracking";
import { AppStateProvider } from "@/providers/AppState";
import ToastHost from "@/components/ToastHost";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090B' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="watch" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="s/[token]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [ibmLoaded] = useIBM({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_700Bold,
  });
  const [serifLoaded] = useSerif({ InstrumentSerif_400Regular });

  useEffect(() => {
    if (ibmLoaded && serifLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
    captureRefFromUrl();
  }, [ibmLoaded, serifLoaded]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#09090B' }}>
          <AppStateProvider>
            <RootLayoutNav />
            <ToastHost />
          </AppStateProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
