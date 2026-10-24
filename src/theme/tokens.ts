/**
 * Centralized Design Tokens for GPS Manhunt
 * Engineered for outdoor tactical visibility, sunlight legibility, and dark aesthetic.
 */

export const colors = {
  // Deep Backgrounds
  background: {
    base: '#0B0E14',       // Pitch void obsidian
    surface: '#141A23',    // Card / module surface
    elevated: '#1D2533',   // Modals / dropdowns
    overlay: 'rgba(11, 14, 20, 0.88)',
  },

  // Tactical Faction Accents
  hunter: {
    primary: '#00F0FF',    // Electric Cyber Cyan
    glow: 'rgba(0, 240, 255, 0.35)',
    muted: '#007A85',
    contrastText: '#061018',
  },

  runner: {
    primary: '#FF9E00',    // Predator Neon Amber
    glow: 'rgba(255, 158, 0, 0.35)',
    muted: '#945800',
    contrastText: '#180E00',
  },

  referee: {
    primary: '#A855F7',    // Overseer Purple
    glow: 'rgba(168, 85, 247, 0.35)',
    muted: '#581C87',
    contrastText: '#140520',
  },

  // Semantic Status
  status: {
    safe: '#10B981',       // High-visibility Emerald
    safeGlow: 'rgba(16, 185, 129, 0.3)',
    warning: '#F59E0B',    // Solar Amber
    danger: '#EF4444',     // Crimson Alert
    dangerGlow: 'rgba(239, 68, 68, 0.4)',
    neutral: '#64748B',    // Gunmetal Slate
  },

  // Typography & Borders
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#64748B',
    accent: '#00F0FF',
  },

  border: {
    subtle: '#222F3E',
    active: '#384B66',
    hunter: '#00F0FF',
    runner: '#FF9E00',
  },
} as const;

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'Courier',
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
    tactical: 1.5,
    wide: 2.0,
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
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;
