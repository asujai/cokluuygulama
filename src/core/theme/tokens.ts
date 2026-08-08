export interface ColorTheme {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceElevated: string;
  card: string;
  cardBorder: string;
  divider: string;
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  error: string;
  errorContainer: string;
  onError: string;
  onErrorContainer: string;
  success: string;
  successContainer: string;
  onSuccess: string;
  warning: string;
  warningContainer: string;
  onWarning: string;
  star: string;
  inputBackground: string;
  inputBorder: string;
  inputBorderFocused: string;
  ripple: string;
}

export const lightTheme: ColorTheme = {
  isDark: false,
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceVariant: '#EEF2F6',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  divider: '#EDF2F7',
  primary: '#1E40AF',
  primaryContainer: '#DBEAFE',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#1E3A8A',
  accent: '#0D9488',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  onError: '#FFFFFF',
  onErrorContainer: '#991B1B',
  success: '#16A34A',
  successContainer: '#DCFCE7',
  onSuccess: '#FFFFFF',
  warning: '#D97706',
  warningContainer: '#FEF3C7',
  onWarning: '#FFFFFF',
  star: '#F59E0B',
  inputBackground: '#F1F5F9',
  inputBorder: '#CBD5E1',
  inputBorderFocused: '#2563EB',
  ripple: 'rgba(30, 64, 175, 0.08)',
};

export const darkTheme: ColorTheme = {
  isDark: true,
  background: '#0F172A',
  surface: '#1E293B',
  surfaceVariant: '#334155',
  surfaceElevated: '#243248',
  card: '#1E293B',
  cardBorder: '#334155',
  divider: '#1E293B',
  primary: '#60A5FA',
  primaryContainer: '#1E3A8A',
  onPrimary: '#0F172A',
  onPrimaryContainer: '#DBEAFE',
  accent: '#2DD4BF',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',
  error: '#EF4444',
  errorContainer: '#7F1D1D',
  onError: '#FFFFFF',
  onErrorContainer: '#FECACA',
  success: '#22C55E',
  successContainer: '#14532D',
  onSuccess: '#FFFFFF',
  warning: '#FBBF24',
  warningContainer: '#78350F',
  onWarning: '#0F172A',
  star: '#FBBF24',
  inputBackground: '#0F172A',
  inputBorder: '#475569',
  inputBorderFocused: '#60A5FA',
  ripple: 'rgba(96, 165, 250, 0.12)',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  titleLarge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
  },
  titleMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  titleSmall: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  labelLarge: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  labelSmall: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600' as const,
  },
  mono: {
    fontFamily: 'monospace',
  },
} as const;
