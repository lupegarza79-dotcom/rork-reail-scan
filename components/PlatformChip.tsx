import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface PlatformChipProps {
  label: string;
  onPress: () => void;
  isActive?: boolean;
}

export default function PlatformChip({ label, onPress, isActive = false }: PlatformChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, isActive && styles.activeChip]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, isActive && styles.activeLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  activeLabel: {
    color: Colors.text,
  },
});
