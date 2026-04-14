import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Shield size={48} color={Colors.textTertiary} />
          <Text style={styles.title}>Page Not Found</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
            <Text style={styles.btnText}>Go to Scanner</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'white',
  },
});
