/**
 * REAiL Trust Engine — Design Tokens
 * Dark, premium, fintech/security feel.
 */
const Colors = {
  background: '#0B0B0F',
  backgroundSecondary: '#111116',
  backgroundTertiary: '#17171D',
  surface: '#13131A',
  surfaceElevated: '#1B1B23',
  text: '#FAFAFA',
  textSecondary: '#B4B4BD',
  textTertiary: '#6B6B75',
  border: '#26262E',
  cardBorder: '#2E2E38',

  card: '#0E0E11',

  // Brand accent — kept for legacy
  primary: '#3B82F6',
  accent: '#8B5CF6',

  // Semantic
  verified: '#10B981',
  verifiedBg: 'rgba(16, 185, 129, 0.10)',
  unverified: '#F59E0B',
  unverifiedBg: 'rgba(245, 158, 11, 0.10)',
  highRisk: '#EF4444',
  highRiskBg: 'rgba(239, 68, 68, 0.10)',
  info: '#60A5FA',
  infoBg: 'rgba(96, 165, 250, 0.10)',

  light: {
    text: '#F5F5F7',
    background: '#09090B',
    tint: '#3B82F6',
    tabIconDefault: '#52525B',
    tabIconSelected: '#3B82F6',
  },
};

import { Platform } from 'react-native';

const SANS = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) as string;
const SANS_MEDIUM = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
}) as string;

export const Fonts = {
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_700Bold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: SANS,
  sansMedium: SANS_MEDIUM,
  sansBold: SANS_MEDIUM,
} as const;

export default Colors;
