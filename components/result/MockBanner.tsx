import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function MockBanner() {
  return (
    <View style={styles.container}>
      <WifiOff size={14} color={Colors.unverified} strokeWidth={2.5} />
      <Text style={styles.text}>
        Offline / simulated result — verification pending
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: Colors.unverifiedBg,
    borderWidth: 1,
    borderColor: `${Colors.unverified}40`,
  },
  text: {
    flex: 1,
    color: Colors.unverified,
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
