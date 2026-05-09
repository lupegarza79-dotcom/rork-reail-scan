import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, AlertTriangle, ShieldX, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors, { Fonts } from '@/constants/colors';
import { ToastMessage, useAppState } from '@/providers/AppState';
import { SafeAreaView } from 'react-native-safe-area-context';

function ToastRow({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const translate = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        toast.tone === 'danger'
          ? Haptics.NotificationFeedbackType.Error
          : toast.tone === 'warn'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    }
    Animated.parallel([
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translate, {
          toValue: -40,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 2400);
    return () => clearTimeout(timer);
  }, [translate, opacity, toast.tone, onDone]);

  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'warn'
      ? AlertTriangle
      : toast.tone === 'danger'
      ? ShieldX
      : Info;
  const color =
    toast.tone === 'success'
      ? Colors.verified
      : toast.tone === 'warn'
      ? Colors.unverified
      : toast.tone === 'danger'
      ? Colors.highRisk
      : Colors.info;

  return (
    <Animated.View
      style={[
        styles.toast,
        { borderColor: color, transform: [{ translateY: translate }], opacity },
      ]}
    >
      <Icon size={18} color={color} strokeWidth={2.5} />
      <View style={styles.body}>
        <Text style={styles.title}>{toast.title}</Text>
        {toast.subtitle ? <Text style={styles.subtitle}>{toast.subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
}

export default function ToastHost() {
  const { toasts, dismissToast } = useAppState();

  if (toasts.length === 0) return null;

  return (
    <SafeAreaView style={styles.host} pointerEvents="box-none" edges={['top']}>
      {toasts.slice(-3).map((t) => (
        <ToastRow key={t.id} toast={t} onDone={() => dismissToast(t.id)} />
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
