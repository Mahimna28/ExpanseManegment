/**
 * ExpenseShare Design System Tokens
 * Primary Theme: Light Mode (Clean, crisp, human-designed, inspired by Tricount)
 */

export const colors: Record<string, string> = {
  // Canvases & Surfaces
  background: '#F8FAFC',        // Slate-50: Crisp, clean light background
  surface: '#FFFFFF',           // Pure white: Cards, lists, sheets
  surfaceSubtle: '#F1F5F9',     // Slate-100: Input backgrounds, pill selectors
  surfaceElevated: '#FFFFFF',

  // Hairlines & Borders
  border: '#E2E8F0',            // Slate-200: Subtle hairline borders
  borderSubtle: '#F1F5F9',      // Slate-100: Internal row dividers
  divider: '#EDF2F7',

  // Typography
  text: '#0F172A',              // Slate-900: Primary high-contrast text
  textMuted: '#64748B',         // Slate-500: Subtitles, metadata, timestamps
  textDim: '#94A3B8',           // Slate-400: Placeholders, captions

  // Primary Brand & Action
  primary: '#2563EB',           // Blue-600: Intentional primary buttons & links
  primaryDark: '#1D4ED8',       // Blue-700
  primarySubtle: '#EFF6FF',     // Blue-50: Subtle tint for active tabs/chips

  // Financial Semantics (Money Values)
  moneyPositive: '#059669',     // Emerald-600: "You are owed" / Positive balance
  moneyPositiveBg: '#ECFDF5',   // Emerald-50: Soft green badge tint
  moneyNegative: '#E11D48',     // Rose-600: "You owe" / Negative balance
  moneyNegativeBg: '#FFF1F2',   // Rose-50: Soft rose badge tint
  moneyNeutral: '#64748B',      // Slate-500: Settled / 0 balance
  moneyNeutralBg: '#F1F5F9',    // Slate-100

  // System States
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
} as const;

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
  sm: 6,
  md: 10,
  lg: 14,
  pill: 24,
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
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
