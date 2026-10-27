/**
 * Centralized Design Tokens for GPS Manhunt
 * Replicated exactly from reference-app design system:
 * - Pixel-sampled signature sunset gradient: Magenta (#C44C8B) -> Coral (#DC5F52) -> Orange (#F2731D)
 * - Light surface background (#F8F9FA) with crisp white cards (#FFFFFF) and 1px border (#E5E7EB)
 * - Clean typography powered by Inter font family
 * - Chaser theme: #F2731D / #DC5F52
 * - Runner theme: #06B6D4 / #10B981
 * - Referee theme: #8B5CF6
 */

export const colors = {
  // Brand Sunset Gradient Tokens (Exact sampled values)
  brand: {
    gradientStart: '#C44C8B',
    gradientMid: '#DC5F52',
    gradientEnd: '#F2731D',
    gradient: ['#C44C8B', '#DC5F52', '#F2731D'] as const,
    accent: '#DC5F52',
  },

  // Light Backgrounds
  background: {
    base: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceCard: '#FFFFFF',
    surfaceCardActive: '#F3F4F6',
    elevated: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },

  // Tactical Role Factions
  hunter: {
    primary: '#F2731D',
    secondary: '#DC5F52',
    glow: 'rgba(242, 115, 29, 0.25)',
    muted: '#C44C8B',
    contrastText: '#FFFFFF',
  },

  runner: {
    primary: '#06B6D4',
    secondary: '#10B981',
    glow: 'rgba(6, 182, 212, 0.25)',
    muted: '#0E7490',
    contrastText: '#FFFFFF',
  },

  referee: {
    primary: '#8B5CF6',
    glow: 'rgba(139, 92, 246, 0.25)',
    muted: '#6D28D9',
    contrastText: '#FFFFFF',
  },

  // Semantic Status
  status: {
    safe: '#10B981',
    safeGlow: 'rgba(16, 185, 129, 0.25)',
    warning: '#F59E0B',
    warningGlow: 'rgba(245, 158, 11, 0.25)',
    danger: '#EF4444',
    dangerGlow: 'rgba(239, 68, 68, 0.25)',
    neutral: '#9CA3AF',
  },

  // Typography & Content
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    muted: '#9CA3AF',
    accent: '#DC5F52',
    cyan: '#06B6D4',
    white: '#FFFFFF',
  },

  // Borders
  border: {
    subtle: '#F3F4F6',
    default: '#E5E7EB',
    glass: '#E5E7EB',
    active: '#DC5F52',
    hunter: '#F2731D',
    runner: '#06B6D4',
    referee: '#8B5CF6',
    gradient: '#DC5F52',
  },

  // UI Surfaces & Components
  portal: {
    bg: '#F8F9FA',
    bgWhite: '#FFFFFF',
    card: '#FFFFFF',
    cardBorder: '#E5E7EB',
    cardHover: '#F9FAFB',
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    surface: '#F3F4F6',
    pillBg: '#F3F4F6',
    pillBorder: '#E5E7EB',
    pillText: '#374151',
    accent: '#DC5F52',
    accentGlow: 'rgba(220, 95, 82, 0.2)',
  },
} as const;

export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    mono: 'monospace',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 36,
  },
  letterSpacing: {
    tight: 0.2,
    normal: 0,
    tactical: 1.2,
    wide: 2.0,
    code: 6,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
