import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Pressable } from 'react-native';
import { Globe, Share2, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ScanResult } from '@/types/scan';
import Badge from './Badge';


interface ScanCardProps {
  scan: ScanResult;
  onPress: () => void;
  onShare?: () => void;
  compact?: boolean;
}

export default function ScanCard({ scan, onPress, onShare, compact = false }: ScanCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getPlatformIcon = () => {
    return <Globe size={compact ? 18 : 24} color={Colors.textSecondary} />;
  };

  const getBadgeColor = () => {
    if (scan.badge === 'VERIFIED') return Colors.verified;
    if (scan.badge === 'UNVERIFIED') return Colors.unverified;
    return Colors.highRisk;
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View 
        style={[
          styles.container, 
          compact && styles.containerCompact,
          { 
            transform: [{ scale: scaleAnim }],
            borderLeftColor: getBadgeColor(),
          }
        ]}
      >
      <View style={[styles.iconContainer, compact && styles.iconContainerCompact]}>
        {getPlatformIcon()}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.domain, compact && styles.domainCompact]} numberOfLines={1}>
          {scan.domain}
        </Text>
        {scan.title && !compact && (
          <Text style={styles.title} numberOfLines={1}>
            {scan.title}
          </Text>
        )}
        <View style={styles.meta}>
          <Badge type={scan.badge} size="small" />
          <Text style={styles.score}>{scan.score}</Text>
          {!compact && <Text style={styles.date}>{formatDate(scan.timestamp)}</Text>}
        </View>
      </View>

        <View style={styles.actions}>
          {onShare && (
            <TouchableOpacity onPress={onShare} style={styles.shareButton}>
              <Share2 size={16} color={Colors.primaryLight} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.viewButton} onPress={onPress}>
            <ExternalLink size={14} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  containerCompact: {
    padding: 12,
    borderRadius: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  domain: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  domainCompact: {
    fontSize: 14,
  },
  title: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  score: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  date: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
