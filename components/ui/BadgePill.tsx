import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react-native';
import Colors from '@/constants/colors';

export type BadgeType = 'VERIFIED' | 'UNVERIFIED' | 'HIGH_RISK';

interface BadgePillProps {
  badge: BadgeType;
  size?: 'small' | 'medium' | 'large' | 'hero';
  showIcon?: boolean;
  showLabel?: boolean;
  showSubtitle?: boolean;
  animated?: boolean;
}

const badgeConfig = {
  VERIFIED: {
    color: Colors.verified,
    bg: Colors.verifiedBg,
    label: 'VERIFIED',
    subtitle: 'Verified by evidence, not by popularity',
    Icon: ShieldCheck,
  },
  UNVERIFIED: {
    color: Colors.unverified,
    bg: Colors.unverifiedBg,
    label: 'UNVERIFIED',
    subtitle: 'Not enough evidence to confirm authenticity',
    Icon: ShieldAlert,
  },
  HIGH_RISK: {
    color: Colors.highRisk,
    bg: Colors.highRiskBg,
    label: 'HIGH RISK',
    subtitle: 'High-risk signals detected',
    Icon: ShieldX,
  },
};

export default function BadgePill({ 
  badge, 
  size = 'medium', 
  showIcon = true,
  showLabel = true,
  showSubtitle = false,
  animated = false,
}: BadgePillProps) {
  const config = badgeConfig[badge] || badgeConfig.UNVERIFIED;
  const { color, bg, label, subtitle, Icon } = config;

  const sizeStyles = {
    small: {
      paddingH: 8,
      paddingV: 4,
      iconSize: 12,
      fontSize: 9,
      borderRadius: 6,
      gap: 4,
    },
    medium: {
      paddingH: 10,
      paddingV: 6,
      iconSize: 14,
      fontSize: 11,
      borderRadius: 8,
      gap: 5,
    },
    large: {
      paddingH: 14,
      paddingV: 8,
      iconSize: 18,
      fontSize: 13,
      borderRadius: 10,
      gap: 6,
    },
    hero: {
      paddingH: 20,
      paddingV: 12,
      iconSize: 24,
      fontSize: 16,
      borderRadius: 14,
      gap: 8,
    },
  };

  const s = sizeStyles[size];

  const containerStyle = [
    styles.container,
    {
      backgroundColor: bg,
      borderColor: `${color}50`,
      paddingHorizontal: s.paddingH,
      paddingVertical: s.paddingV,
      borderRadius: s.borderRadius,
      gap: s.gap,
    },
  ];

  const content = (
    <>
      {showIcon && <Icon size={s.iconSize} color={color} strokeWidth={2.5} />}
      <View style={showSubtitle ? styles.textContainer : undefined}>
        {showLabel && (
          <Text
            style={[
              styles.label,
              {
                color,
                fontSize: s.fontSize,
              },
            ]}
          >
            {label}
          </Text>
        )}
        {showSubtitle && (
          <Text style={[styles.subtitle, { color: `${color}CC` }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </>
  );

  if (animated) {
    return (
      <Animated.View style={containerStyle}>
        {content}
      </Animated.View>
    );
  }

  return (
    <View style={containerStyle}>
      {content}
    </View>
  );
}

export function getBadgeColor(badge: BadgeType): string {
  return badgeConfig[badge]?.color || Colors.unverified;
}

export function getBadgeBg(badge: BadgeType): string {
  return badgeConfig[badge]?.bg || Colors.unverifiedBg;
}

export function getBadgeLabel(badge: BadgeType): string {
  return badgeConfig[badge]?.label || 'UNVERIFIED';
}

export function getBadgeSubtitle(badge: BadgeType): string {
  return badgeConfig[badge]?.subtitle || 'Not enough evidence to confirm authenticity';
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  textContainer: {
    flexDirection: 'column',
  },
  label: {
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '500' as const,
    marginTop: 2,
  },
});
