// Vector Icon Component for Categories, Actions, and Integrations (NO EMOJIS)
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const CATEGORY_COLOR_MAP: Record<string, { color: string; bg: string; iconName: any; iconSet: 'ionicons' | 'material' }> = {
  'Food & Dining': { color: '#10b981', bg: '#064e3b', iconName: 'restaurant', iconSet: 'ionicons' },
  'Transport / Fuel': { color: '#38bdf8', bg: '#172554', iconName: 'car', iconSet: 'ionicons' },
  'Airtime & Data': { color: '#c084fc', bg: '#2e1065', iconName: 'phone-portrait', iconSet: 'ionicons' },
  'Utilities & Bills': { color: '#fb923c', bg: '#451a03', iconName: 'flash', iconSet: 'ionicons' },
  'Shopping': { color: '#f472b6', bg: '#4c0519', iconName: 'bag-handle', iconSet: 'ionicons' },
  'Housing & Rent': { color: '#2dd4bf', bg: '#042f2e', iconName: 'home', iconSet: 'ionicons' },
  'Entertainment': { color: '#818cf8', bg: '#1e1b4b', iconName: 'film', iconSet: 'ionicons' },
  'Transfer / Sent': { color: '#a78bfa', bg: '#2e1065', iconName: 'bank-transfer', iconSet: 'material' },
  'Other': { color: '#94a3b8', bg: '#1e293b', iconName: 'wallet', iconSet: 'ionicons' },
  'Uncategorized': { color: '#f87171', bg: '#450a0a', iconName: 'help', iconSet: 'ionicons' },
};

export function CategoryIcon({
  category,
  size = 18,
  color,
  backgroundColor,
  containerStyle,
}: CategoryIconProps) {
  const meta = CATEGORY_COLOR_MAP[category] || {
    color: '#94a3b8',
    bg: '#1e293b',
    iconName: 'wallet',
    iconSet: 'ionicons',
  };

  const iconColor = color || meta.color;
  const bgColor = backgroundColor !== undefined ? backgroundColor : meta.bg;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, containerStyle]}>
      {meta.iconSet === 'material' ? (
        <MaterialCommunityIcons name={meta.iconName} size={size} color={iconColor} />
      ) : (
        <Ionicons name={meta.iconName} size={size} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
