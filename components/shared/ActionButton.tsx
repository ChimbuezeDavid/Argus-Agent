// Reusable ActionButton component — styled buttons (primary, secondary, danger)
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { useHCITheme } from '@/hooks/useHCITheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Full width (flex: 1) */
  flex?: boolean;
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  flex = false,
}: ActionButtonProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  const getButtonStyles = (): { bg: string; border: string; text: string } => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primary, border: colors.primary, text: '#ffffff' };
      case 'secondary':
        return { bg: colors.cardActive, border: colors.border, text: colors.text };
      case 'danger':
        return { bg: 'transparent', border: colors.danger, text: colors.danger };
      case 'outline':
        return { bg: 'transparent', border: colors.borderStrong, text: colors.text };
      default:
        return { bg: colors.primary, border: colors.primary, text: '#ffffff' };
    }
  };

  const btnStyle = getButtonStyles();

  const handlePress = () => {
    if (disabled || loading) return;
    triggerHaptic('selection');
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: btnStyle.bg,
          borderColor: btnStyle.border,
          opacity: disabled ? 0.5 : 1,
        },
        flex && { flex: 1 },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={btnStyle.text} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: btnStyle.text, fontSize: scaleFont(12) }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  label: {
    fontWeight: '700',
  },
});
