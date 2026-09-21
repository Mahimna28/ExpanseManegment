/**
 * ExpenseShare Design System — "Crafted Clarity"
 * Primary Theme: Light Mode (Warm porcelain, indigo accent, emerald credit, coral debit)
 */

export const colors: Record<string, string> = {
  // Canvas & Backgrounds
  background: '#F8F9FA',         // Warm porcelain/chalk: clean, glare-free, organic
  surface: '#FFFFFF',            // Crisp pure white cards and tiles
  surfaceSubtle: '#F1F3F5',      // Soft slate-gray for inputs, pill switchers
  surfaceHover: '#F8FAFC',
  surfaceCard: '#FFFFFF',

  // Hairlines & Borders
  border: '#E9ECEF',             // Ultra-fine light border
  borderSubtle: '#F1F3F5',
  borderStrong: '#DDE2E5',

  // Typography
  text: '#0F172A',               // Obsidian slate: high contrast, ultra-readable
  textMuted: '#64748B',          // Medium slate: secondary labels, timestamps
  textDim: '#94A3B8',            // Light slate: placeholders, micro captions
  textWhite: '#FFFFFF',

  // Brand & Action Accent (Modern Indigo / Violet - distinctive & premium)
  primary: '#4F46E5',            // Indigo-600
  primaryDark: '#4338CA',        // Indigo-700
  primaryLight: '#6366F1',       // Indigo-500
  primarySubtle: '#EEF2FF',      // Indigo-50: soft pill tint
  primaryBorder: '#C7D2FE',      // Indigo-200

  // Financial Semantics
  // Positive: Owed to you / Money in
  moneyPositive: '#059669',      // Emerald-600
  moneyPositiveBg: '#ECFDF5',    // Mint emerald tint
  moneyPositiveBorder: '#A7F3D0',// Emerald-200

  // Negative: You owe / Money out
  moneyNegative: '#E11D48',      // Rose-600
  moneyNegativeBg: '#FFF1F2',    // Soft coral tint
  moneyNegativeBorder: '#FECDD3',// Rose-200

  // Neutral: All settled
  moneyNeutral: '#64748B',       // Slate-500
  moneyNeutralBg: '#F1F5F9',     // Slate-100
  moneyNeutralBorder: '#E2E8F0',

  // System
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  success: '#10B981',
};

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
    color: colors.text,
  },
  largeTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
    color: colors.text,
  },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.text,
  },
  bodySemibold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.text,
  },
  secondary: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.textMuted,
  },
  secondarySemibold: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    color: colors.textMuted,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: colors.textDim,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
  full: 9999,
} as const;

export const shadows = {
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
