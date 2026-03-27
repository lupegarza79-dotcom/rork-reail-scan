import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { BadgeType } from '@/types/scan';
import { useApp } from '@/contexts/AppContext';

interface BadgeProps {
  type: BadgeType;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export default function Badge({ type, size = 'medium', showLabel = true }: BadgeProps) {
  const { t } = useApp();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  
  const config = {
    VERIFIED: {
      color: Colors.verified,
      bg: Colors.verifiedBg,
      glow: Colors.verifiedGlow,
      icon: CheckCircle,
      label: t.verified,
    },
    UNVERIFIED: {
      color: Colors.unverified,
      bg: Colors.unverifiedBg,
      glow: Colors.unverifiedGlow,
      icon: AlertTriangle,
      label: t.unverified,
    },
    HIGH_RISK: {
      color: Colors.highRisk,
      bg: Colors.highRiskBg,
      glow: Colors.highRiskGlow,
      icon: XCircle,
      label: t.highRisk,
    },
  };

  useEffect(() => {
    if (size === 'large') {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.02,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.6,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }
  }, [size, pulseAnim, glowAnim]);

  const { color, bg, icon: Icon, label } = config[type];
  const iconSize = size === 'small' ? 14 : size === 'medium' ? 22 : 44;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 13 : 18;
  const paddingH = size === 'small' ? 8 : size === 'medium' ? 14 : 24;
  const paddingV = size === 'small' ? 4 : size === 'medium' ? 8 : 14;
  const borderRadius = size === 'small' ? 8 : size === 'medium' ? 12 : 20;

  const containerStyle = [
    styles.container,
    {
      backgroundColor: bg,
      paddingHorizontal: paddingH,
      paddingVertical: paddingV,
      borderRadius,
      borderWidth: 1,
      borderColor: color + '30',
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: size === 'large' ? 0.4 : 0.2,
      shadowRadius: size === 'large' ? 16 : 8,
      elevation: size === 'large' ? 8 : 4,
    },
  ];

  if (size === 'large') {
    return (
      <Animated.View 
        style={[
          containerStyle,
          { transform: [{ scale: pulseAnim }], opacity: Animated.add(0.7, Animated.multiply(glowAnim, 0.5)) }
        ]}
      >
        <Icon size={iconSize} color={color} />
        {showLabel && (
          <Text style={[styles.label, { color, fontSize, marginLeft: 10 }]}>
            {label}
          </Text>
        )}
      </Animated.View>
    );
  }

  return (
    <View style={containerStyle}>
      <Icon size={iconSize} color={color} />
      {showLabel && (
        <Text style={[styles.label, { color, fontSize, marginLeft: size === 'small' ? 4 : 8 }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
