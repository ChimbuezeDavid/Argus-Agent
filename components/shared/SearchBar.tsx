// Reusable SearchBar component — themed search input with icon
import React from 'react';
import { View, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', style }: SearchBarProps) {
  const { colors, scaleFont } = useHCITheme();

  return (
    <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.surface }, style]}>
      <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
      <TextInput
        style={[styles.searchInput, { color: colors.text, fontSize: scaleFont(13) }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
  },
});
