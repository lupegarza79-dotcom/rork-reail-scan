import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

export default function SectionCard({
  title,
  subtitle,
  icon,
  children,
  style,
  noPadding = false,
}: SectionCardProps) {
  return (
    <View style={[styles.container, style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {icon && <View style={styles.iconSlot}>{icon}</View>}
          <View style={styles.headerText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
      )}
      <View style={noPadding ? undefined : styles.content}>{children}</View>
    </View>
  );
}

export function SectionHeader({ 
  title, 
  subtitle 
}: { 
  title: string; 
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 0,
    gap: 10,
  },
  iconSlot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  subtitle: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  content: {
    padding: 14,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
});
