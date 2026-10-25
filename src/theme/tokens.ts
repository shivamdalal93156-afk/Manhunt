/**
 * Centralized Design Tokens for Hunting Game: GPS Manhunt
 * Exact replica of the official Hunting Game design system:
 * - Signature sunset gradient: Magenta (#BD4798) -> Sunset Coral (#E85D3B) -> Bright Orange (#F9790C)
 * - Deep obsidian void background (#0A0A0A)
 * - Frosted glass card surfaces (rgba(255,255,255,0.07) + 1px white/12% border)
 * - Chaser theme: Sunset Coral (#E85D3B)
 * - Runner theme: High-Vis Cyan / Emerald (#00E5FF / #10B981)
 */

export const colors = {
  // Brand Sunset Gradient Tokens
  brand: {
    gradientStart: '#BD4798',
    gradientMid: '#E85D3B',
    gradientEnd: '#F9790C',
    gradient: ['#BD4798', '#E85D3B', '#F9790C'] as const,
    accent: '#E85D3B',
  },

  // Deep Obsidian Backgrounds
  background: {
    base: '#0A0A0A',
    surface: '#141414',
    surfaceCard: 'rgba(255, 255, 255, 0.07)',
    surfaceCardActive: 'rgba(255, 255, 255, 0.12)',
    elevated: '#1E1E1E',
    overlay: 'rgba(10, 10, 10, 0.92)',
  },

  // Tactical Role Factions
  hunter: {
    primary: '#E85D3B',        // Chaser signature Sunset Coral
    secondary: '#BD4798',
    glow: 'rgba(232, 93, 59, 0.35)',
    muted: '#8A2D16',
    contrastText: '#FFFFFF',
  },

  runner: {
    primary: '#00E5FF',        // Evader High-Vis Cyan
    secondary: '#10B981',      // Evader Safe Emerald
    glow: 'rgba(0, 229, 255, 0.35)',
    muted: '#006570',
    contrastText: '#061018',
  },

  referee: {
    primary: '#A855F7',        // Overseer Purple
    glow: 'rgba(168, 85, 247, 0.35)',
    muted: '#581C87',
    contrastText: '#FFFFFF',
  },

  // Semantic Status
  status: {
    safe: '#10B981',           // Emerald
    safeGlow: 'rgba(16, 185, 129, 0.3)',
    warning: '#F59E0B',        // Amber
    warningGlow: 'rgba(245, 158, 11, 0.3)',
    danger: '#EF4444',         // Alert Crimson
    dangerGlow: 'rgba(239, 68, 68, 0.45)',
    neutral: '#71717A',        // Zinc Muted
  },

  // Typography & Glass Borders
  text: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    muted: '#71717A',
    accent: '#E85D3B',
    cyan: '#00E5FF',
  },

  border: {
    glass: 'rgba(255, 255, 255, 0.12)',
    subtle: 'rgba(255, 255, 255, 0.08)',
    active: 'rgba(255, 255, 255, 0.22)',
    hunter: '#E85D3B',
    runner: '#00E5FF',
    gradient: '#E85D3B',
  },
} as const;

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'monospace',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 38,
  },
  letterSpacing: {
    tight: 0.5,
    tactical: 1.5,
    wide: 2.2,
    code: 8,
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
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

