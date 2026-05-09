/**
 * REAiL Trust Engine — Design Tokens
 * Dark, premium, fintech/security feel.
 */
const Colors = {
  background: '#09090B',
  backgroundSecondary: '#101013',
  backgroundTertiary: '#16161B',
  surface: '#0E0E11',
  surfaceElevated: '#17171C',
  text: '#F5F5F7',
  textSecondary: '#A1A1AA',
  textTertiary: '#52525B',
  border: '#1F1F25',
  cardBorder: '#26262E',

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

export const Fonts = {
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_700Bold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

export default Colors;
