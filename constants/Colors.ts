export interface ColorPalette {
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  surface: string;
  card: string;
  cardActive: string;
  border: string;
  borderStrong: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  primary: string;
  primaryBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  inputBg: string;
  modalOverlay: string;
}

export const DarkPalette: ColorPalette = {
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  background: '#09090b',
  surface: '#121215',
  card: '#18181b',
  cardActive: '#27272a',
  border: '#27272a',
  borderStrong: '#3f3f46',
  tint: '#60a5fa',
  tabIconDefault: '#71717a',
  tabIconSelected: '#3b82f6',
  primary: '#3b82f6',
  primaryBg: 'rgba(59, 130, 246, 0.15)',
  success: '#10b981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  inputBg: '#27272a',
  modalOverlay: 'rgba(0, 0, 0, 0.82)',
};

export const LightPalette: ColorPalette = {
  text: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#71717a',
  background: '#f4f4f5',
  surface: '#ffffff',
  card: '#ffffff',
  cardActive: '#e4e4e7',
  border: '#e4e4e7',
  borderStrong: '#d4d4d8',
  tint: '#2563eb',
  tabIconDefault: '#a1a1aa',
  tabIconSelected: '#2563eb',
  primary: '#2563eb',
  primaryBg: 'rgba(37, 99, 235, 0.10)',
  success: '#059669',
  successBg: 'rgba(5, 150, 105, 0.10)',
  warning: '#d97706',
  warningBg: 'rgba(217, 119, 6, 0.10)',
  danger: '#dc2626',
  dangerBg: 'rgba(220, 38, 38, 0.10)',
  inputBg: '#f4f4f5',
  modalOverlay: 'rgba(0, 0, 0, 0.55)',
};

export const HighContrastDarkPalette: ColorPalette = {
  text: '#ffffff',
  textSecondary: '#e4e4e7',
  textMuted: '#d4d4d8',
  background: '#000000',
  surface: '#0d0d0d',
  card: '#141414',
  cardActive: '#222222',
  border: '#ffffff',
  borderStrong: '#ffffff',
  tint: '#93c5fd',
  tabIconDefault: '#a1a1aa',
  tabIconSelected: '#60a5fa',
  primary: '#60a5fa',
  primaryBg: 'rgba(96, 165, 250, 0.3)',
  success: '#4ade80',
  successBg: 'rgba(74, 222, 128, 0.3)',
  warning: '#fde047',
  warningBg: 'rgba(253, 224, 71, 0.3)',
  danger: '#f87171',
  dangerBg: 'rgba(248, 113, 113, 0.3)',
  inputBg: '#1f1f1f',
  modalOverlay: 'rgba(0, 0, 0, 0.92)',
};

export const HighContrastLightPalette: ColorPalette = {
  text: '#000000',
  textSecondary: '#18181b',
  textMuted: '#27272a',
  background: '#ffffff',
  surface: '#f9f9f9',
  card: '#f0f0f0',
  cardActive: '#e0e0e0',
  border: '#000000',
  borderStrong: '#000000',
  tint: '#003eb3',
  tabIconDefault: '#52525b',
  tabIconSelected: '#003eb3',
  primary: '#003eb3',
  primaryBg: 'rgba(0, 62, 179, 0.15)',
  success: '#006600',
  successBg: 'rgba(0, 102, 0, 0.15)',
  warning: '#8c4400',
  warningBg: 'rgba(140, 68, 0, 0.15)',
  danger: '#b30000',
  dangerBg: 'rgba(179, 0, 0, 0.15)',
  inputBg: '#ffffff',
  modalOverlay: 'rgba(0, 0, 0, 0.70)',
};

export default {
  light: LightPalette,
  dark: DarkPalette,
  highContrastDark: HighContrastDarkPalette,
  highContrastLight: HighContrastLightPalette,
};
