import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react-native';
import Colors from '@/constants/colors';

export type BadgeType = 'VERIFIED' | 'UNVERIFIED' | 'HIGH_RISK';

interface BadgePillProps {
  badge: BadgeType;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  showLabel?: boolean;
}

const badgeConfig = {
  VERIFIED: {
    color: Colors.verified,
    bg: Colors.verifiedBg,
    label: 'VERIFIED',
    Icon: ShieldCheck,
  },
  UNVERIFIED: {
    color: Colors.unverified,
    bg: Colors.unverifiedBg,
    label: 'UNVERIFIED',
    Icon: ShieldAlert,
  },
  HIGH_RISK: {
    color: Colors.highRisk,
    bg: Colors.highRiskBg,
    label: 'HIGH RISK',
    Icon: ShieldX,
  },
};

export default function BadgePill({ 
  badge, 
  size = 'medium', 
  showIcon = true,
  showLabel = true 
}: BadgePillProps) {
  const config = badgeConfig[badge] || badgeConfig.UNVERIFIED;
  const { color, bg, label, Icon } = config;

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
  };

  const s = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderColor: `${color}40`,
          paddingHorizontal: s.paddingH,
          paddingVertical: s.paddingV,
          borderRadius: s.borderRadius,
          gap: s.gap,
        },
      ]}
    >
      {showIcon && <Icon size={s.iconSize} color={color} strokeWidth={2.5} />}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  label: {
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
});
